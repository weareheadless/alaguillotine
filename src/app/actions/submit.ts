"use server";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import type { SubmitFreeResponse, SubmitPaidResponse, SubmitNominationResponse, NominationEntry } from "../../lib/types";
import { NOMINATION_WEIGHT_FREE, NOMINATION_WEIGHT_MULTIPLIER } from "../../lib/types";
import { ensureEpoch, checkEpochTransition } from "./epoch";
import { LocalDatabases, Query, getDb as getRawDb } from "../../lib/local-db";
import { getSessionUserId } from "../../lib/session";
import { getUserById } from "../../lib/users";
import { verifySolution } from "../../lib/pow";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getDb() {
  return new LocalDatabases();
}

/**
 * Verify a PoW solution against the server-issued challenge.
 * Looks up the challenge in the DB, checks expiry, uses the stored difficulty,
 * and deletes the challenge after verification (one-time use).
 */
async function verifyPow(formData: FormData): Promise<boolean> {
  const challenge = formData.get("pow_challenge")?.toString();
  const nonce = formData.get("pow_nonce")?.toString();
  if (!challenge || !nonce) return false;

  const rawDb = getRawDb();
  const stored = rawDb.prepare(
    "SELECT difficulty, expires_at FROM pow_challenges WHERE challenge = ? AND expires_at > datetime('now')"
  ).get(challenge) as { difficulty: number; expires_at: string } | undefined;

  if (!stored) return false;

  const valid = await verifySolution(challenge, nonce, stored.difficulty);

  // One-time use — delete the challenge regardless of success/failure
  // (on failure, they'll need a fresh challenge; on success, consumed)
  rawDb.prepare("DELETE FROM pow_challenges WHERE challenge = ?").run(challenge);

  return valid;
}

/**
 * Create a nomination document if a target_name was provided.
 * Returns the nomination weight.
 */
async function createNomination(
  db: LocalDatabases,
  targetName: string,
  voterId: string | null,
  voterName: string,
  messageId: string,
  amountPaid: number,
): Promise<number> {
  const weight = amountPaid > 0
    ? Math.max(NOMINATION_WEIGHT_FREE, Math.floor(amountPaid * NOMINATION_WEIGHT_MULTIPLIER))
    : NOMINATION_WEIGHT_FREE;

  db.createDocument(
    "",
    "nominations",
    "unique()",
    {
      target_name: targetName.trim().slice(0, 50),
      voter_id: voterId,
      voter_name: voterName,
      message_id: messageId,
      weight,
      amount_paid: amountPaid,
      created_at: new Date().toISOString(),
    }
  );

  return weight;
}

/**
 * Calls the OpenAI Moderation API.
 * Returns `true` if the message should be shadowbanned.
 */
async function checkModeration(text: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false; // No key = no moderation

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return false;

    // Flag if any of these categories are flagged
    const categories = result.categories ?? {};
    return !!(
      categories.hate ||
      categories["hate/threatening"] ||
      categories.harassment ||
      categories.violence ||
      categories["violence/graphic"]
    );
  } catch {
    return false;
  }
}

// ─── CHOP Token Helpers ─────────────────────────────────────────────────────────

const CHOP_MINT = new PublicKey(process.env.NEXT_PUBLIC_CHOP_MINT || "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump");
const CHOP_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);
const CHOP_UNIT = Math.pow(10, CHOP_DECIMALS); // 1 CHOP = 10^6 raw units
const BURN_ADDRESS = new PublicKey(process.env.CHOP_BURN_ADDRESS || "11111111111111111111111111111111");

/** Load the treasury wallet keypair from the secret key env var (base58). */
function getTreasuryWallet(): Keypair | null {
  const secret = process.env.CHOP_TREASURY_SECRET_KEY;
  if (!secret) return null;
  try {
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(decoded);
  } catch {
    console.error("[CHOP] Failed to decode treasury secret key");
    return null;
  }
}

/**
 * Send 1 CHOP from the treasury wallet to the burn address.
 * Called after a free message is posted. Non-blocking — fire-and-forget.
 */
async function burnOneChopForFreeMessage(): Promise<void> {
  const treasury = getTreasuryWallet();
  if (!treasury) {
    console.warn("[CHOP] No treasury wallet configured — skipping burn for free message");
    return;
  }

  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpc);

  try {
    // Get (or create) treasury's associated token account for CHOP
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,          // payer for rent if ATA doesn't exist
      CHOP_MINT,
      treasury.publicKey,
      false,             // allowOwnerOffCurve
      undefined,         // commitment
      undefined,         // confirmOptions
      TOKEN_2022_PROGRAM_ID, // CHOP is pump.fun → Token 2022
    );

    const balance = Number(treasuryAta.amount);
    if (balance < CHOP_UNIT) {
      console.warn(`[CHOP] Treasury balance too low: ${balance / CHOP_UNIT} CHOP — skipping burn`);
      return;
    }

    // Transfer 1 CHOP to the burn address
    const sig = await transfer(
      connection,
      treasury,
      treasuryAta.address,
      BURN_ADDRESS,
      treasury.publicKey,
      BigInt(CHOP_UNIT),
      undefined,              // multiSigners
      undefined,              // confirmOptions
      TOKEN_2022_PROGRAM_ID,  // CHOP is Token 2022
    );

    console.log(`[CHOP] Burned 1 CHOP for free message — tx: ${sig}`);
  } catch (err) {
    console.error("[CHOP] Burn failed:", err);
    // Swallow — don't block the user's message posting
  }
}

/**
 * Verify a CHOP payment transaction on-chain.
 *
 * Tries two approaches:
 * 1. Parsed instructions (jsonParsed) — cleanest, but RPC may not parse Token-2022
 * 2. preTokenBalances / postTokenBalances net change — always works, runtime-enforced
 *
 * Returns the transferred amount in CHOP. Throws on any failure.
 */
async function verifyChopPayment(
  txSignature: string,
): Promise<{ amount: number; sender: string }> {
  const CHOP_MINT_STR = CHOP_MINT.toBase58();
  const receiverStr = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET;
  if (!receiverStr) throw new Error("Treasury wallet not configured.");

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  console.log("[CHOP verify] Fetching tx:", txSignature.slice(0, 12) + "...");

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [txSignature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
    }),
  });

  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`RPC: ${body.error.message || JSON.stringify(body.error)}`);
  const tx = body.result;
  if (!tx) throw new Error("Tx not found on-chain yet.");
  if (tx.meta?.err) throw new Error(`Tx failed: ${JSON.stringify(tx.meta.err)}`);

  // Check parsed instructions for Token-2022 transfer → treasury
  const ixs = tx.transaction?.message?.instructions ?? [];
  for (const ix of ixs) {
    const info = ix.parsed?.info;
    if (!info) continue;
    const type = ix.parsed?.type;
    if (type !== "transfer" && type !== "transferChecked") continue;
    if (info.mint !== CHOP_MINT_STR) continue;
    if (info.destination !== receiverStr) continue;

    const amount = info.tokenAmount?.uiAmount ?? Number(info.amount ?? 0) / 1_000_000;
    const sender = info.authority || info.source || "";
    console.log("[CHOP verify] ✅", amount, "CHOP from", sender.slice(0, 10) + "...");
    return { amount, sender };
  }

  // Fallback: balance diff
  const preBals: any[] = tx.meta?.preTokenBalances ?? [];
  const postBals: any[] = tx.meta?.postTokenBalances ?? [];
  const preMap = new Map<number, number>();
  for (const b of preBals) {
    if (b.mint === CHOP_MINT_STR && b.owner === receiverStr) {
      preMap.set(b.accountIndex, Number(b.uiTokenAmount?.uiAmount ?? 0));
    }
  }
  let net = 0;
  for (const b of postBals) {
    if (b.mint === CHOP_MINT_STR && b.owner === receiverStr) {
      net += Number(b.uiTokenAmount?.uiAmount ?? 0) - (preMap.get(b.accountIndex) ?? 0);
    }
  }
  if (net > 0) {
    console.log("[CHOP verify] ✅ Balance diff:", net, "CHOP");
    return { amount: net, sender: "" };
  }

  throw new Error(`No CHOP transfer to treasury. Mint: ${CHOP_MINT_STR.slice(0, 8)}...`);
}

// ─── Wallet profiles — single source of truth for all leaderboards ──────────────

interface WalletProfile {
  wallet: string;
  displayName: string;
  totalPaid: number;
  messageCount: number;
  lastActive: string;
}

function getPaidWalletProfiles(): Map<string, WalletProfile> {
  const rawDb = getRawDb();
  const rows = rawDb.prepare(`
    SELECT LOWER(author_id) as wallet, author_name,
           SUM(amount_paid) as total_paid, COUNT(*) as msg_count,
           MAX(created_at) as last_active
    FROM messages WHERE amount_paid > 0 AND author_id IS NOT NULL AND author_id != ''
    GROUP BY LOWER(author_id)
  `).all() as { wallet: string; author_name: string; total_paid: number; msg_count: number; last_active: string }[];

  const map = new Map<string, WalletProfile>();
  for (const r of rows) {
    map.set(r.wallet, { wallet: r.wallet, displayName: r.author_name, totalPaid: r.total_paid, messageCount: r.msg_count, lastActive: r.last_active });
  }
  return map;
}

// ─── Submit Free Message (Appwrite session required, one per user) ──────────────

export async function submitFreeMessage(formData: FormData): Promise<SubmitFreeResponse> {
  try {
    // Honeypot check — bots fill this hidden field
    const honeypot = formData.get("website");
    if (honeypot && honeypot.toString().trim().length > 0) {
      return { success: true }; // Silently succeed for bots
    }

    const text = formData.get("text")?.toString().trim();
    const customName = formData.get("author_name")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();
    if (!text) return { success: false, error: "Message is required." };

    // Get session user
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: "You must be logged in to post a free message." };
    }

    const user = getUserById(userId);
    if (!user) {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const authorId = user.id;
    const authorName = customName || user.display_name || user.username || "Anonymous";

    // PoW verification — skip for wallet-linked users
    if (!user.wallet_address) {
      const powValid = await verifyPow(formData);
      if (!powValid) {
        return { success: false, error: "Proof of work invalid or expired. Refresh and try again." };
      }
    }

    // Check one-message-per-user limit (only for top-level messages)
    const db = getDb();
    const existing = db.listDocuments(
      "",
      "messages",
      [
        Query.isNull("parent_id"),
        Query.equal("author_id", authorId),
        Query.equal("amount_paid", 0),
        Query.limit(1),
      ]
    );

    if (existing.documents.length > 0) {
      return {
        success: false,
        error: "You've already posted a free message. Only one per person.",
      };
    }

    // Check moderation (shadowban)
    const isShadowbanned = await checkModeration(text);

    // Create document and capture its ID
    const msgDoc = db.createDocument(
      "",
      "messages",
      "unique()",
      {
        text,
        author_id: authorId,
        author_name: authorName,
        amount_paid: 0,
        is_shadowbanned: isShadowbanned,
        created_at: new Date().toISOString(),
      }
    );

    // If user nominated a target, create a nomination
    if (targetName) {
      await createNomination(db, targetName, authorId, authorName, (msgDoc as any).id, 0);
    }

    // Burn 1 CHOP from treasury for this free message (non-blocking)
    burnOneChopForFreeMessage();

    // Ensure epoch exists + check if threshold crossed (non-blocking)
    ensureEpoch();
    checkEpochTransition();

    // Always return success to the client
    return { success: true };
  } catch (err) {
    console.error("submitFreeMessage error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Submit Comment (free, unlimited — only for replies) ───────────────────────

export async function submitComment(formData: FormData): Promise<SubmitFreeResponse> {
  try {
    // Honeypot check — bots fill this hidden field
    const honeypot = formData.get("website");
    if (honeypot && honeypot.toString().trim().length > 0) {
      return { success: true }; // Silently succeed for bots
    }

    const text = formData.get("text")?.toString().trim();
    const customName = formData.get("author_name")?.toString().trim();
    const parentId = formData.get("parent_id")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();
    if (!text) return { success: false, error: "Comment text is required." };
    if (!parentId) return { success: false, error: "Missing parent message ID." };

    // Get session user
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, error: "You must be logged in to comment." };
    }

    const user = getUserById(userId);
    if (!user) {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const authorId = user.id;
    const authorName = customName || user.display_name || user.username || "Anonymous";

    // PoW verification — skip for wallet-linked users
    if (!user.wallet_address) {
      const powValid = await verifyPow(formData);
      if (!powValid) {
        return { success: false, error: "Proof of work invalid or expired. Refresh and try again." };
      }
    }

    // Check moderation (shadowban)
    const isShadowbanned = await checkModeration(text);

    const db = getDb();

    const commentDoc = db.createDocument(
      "",
      "messages",
      "unique()",
      {
        text,
        author_id: authorId,
        author_name: authorName,
        amount_paid: 0,
        is_shadowbanned: isShadowbanned,
        parent_id: parentId,
        created_at: new Date().toISOString(),
      }
    );

    // If user nominated a target, create a nomination
    if (targetName) {
      await createNomination(db, targetName, authorId, authorName, (commentDoc as any).id, 0);
    }

    // Burn 1 CHOP from treasury for this free comment (non-blocking)
    burnOneChopForFreeMessage();

    // Ensure epoch exists + check if threshold crossed (non-blocking)
    ensureEpoch();
    checkEpochTransition();

    return { success: true };
  } catch (err) {
    console.error("submitComment error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Submit Paid Message (Solana, bypasses auth) ────────────────────────────────

export async function submitPaidMessage(formData: FormData): Promise<SubmitPaidResponse> {
  try {
    // Honeypot check — bots fill this hidden field
    const honeypot = formData.get("website");
    if (honeypot && honeypot.toString().trim().length > 0) {
      return { success: true }; // Silently succeed for bots
    }

    const text = formData.get("text")?.toString().trim();
    const authorName = formData.get("author_name")?.toString().trim() || "Anonymous";
    const amountPaid = parseFloat(formData.get("amount_paid")?.toString() || "0");
    const txSignature = formData.get("tx_signature")?.toString().trim();
    const walletAddress = formData.get("wallet_address")?.toString().trim() || null;
    const targetName = formData.get("target_name")?.toString().trim();

    if (!text) return { success: false, error: "Message is required." };
    if (!amountPaid || amountPaid <= 0) {
      return { success: false, error: "Payment amount must be greater than 0." };
    }
    if (!txSignature) {
      return { success: false, error: "Transaction signature is required." };
    }

    // Verify the CHOP transfer on-chain — get sender + amount from chain
    console.log("[CHOP submit] Verifying tx:", txSignature.slice(0, 12) + "...");
    const verified = await verifyChopPayment(txSignature);
    const actualAmount = Math.min(amountPaid, verified.amount);
    const authorId = verified.sender || walletAddress || "";
    console.log("[CHOP submit] ✅ Verified:", actualAmount, "CHOP, sender:", authorId.slice(0, 10) + "...");

    const db = getDb();

    // Paid messages: skip moderation — paying users don't get silently censored
    // Free messages still go through moderation
    const isShadowbanned = false;
    console.log("[CHOP submit] Creating message in DB...");

    const msgDoc = db.createDocument(
      "",
      "messages",
      "unique()",
      {
        text,
        author_id: authorId,
        author_name: authorName,
        amount_paid: actualAmount,
        is_shadowbanned: isShadowbanned,
        created_at: new Date().toISOString(),
      }
    );
    console.log("[CHOP submit] ✅ Message saved, id:", (msgDoc as any).id);

    // If user nominated a target, create a nomination with paid weight
    if (targetName) {
      await createNomination(db, targetName, null, authorName, (msgDoc as any).id, actualAmount);
    }

    // Ensure epoch exists + check if threshold crossed (non-blocking)
    ensureEpoch();
    checkEpochTransition();

    return { success: true, transactionSignature: txSignature };
  } catch (err) {
    console.error("submitPaidMessage error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}


// ─── Server-side leaderboard fetch (used by Leaderboard component) ───────────

export async function fetchLeaderboard(): Promise<NominationEntry[]> {
  try {
    const db = getDb();

    const nominations = db.listDocuments(
      "",
      "nominations",
      [Query.limit(5000)]
    );

    const docs = nominations.documents as unknown as import("../../lib/types").NominationDocument[];

    // Aggregate by target_name
    const agg = new Map<string, { total_weight: number; total_votes: number; total_paid: number; last_nominated_at: string }>();

    for (const doc of docs) {
      const key = doc.target_name.toLowerCase();
      const existing = agg.get(key) || { total_weight: 0, total_votes: 0, total_paid: 0, last_nominated_at: "" };
      existing.total_weight += doc.weight;
      existing.total_votes += 1;
      existing.total_paid += doc.amount_paid;
      if (doc.created_at > existing.last_nominated_at) {
        existing.last_nominated_at = doc.created_at;
      }
      agg.set(key, existing);
    }

    // Convert to sorted array
    const entries: NominationEntry[] = [];
    for (const [lowerName, data] of agg) {
      // Find the original-cased name from one of the docs
      const origName = docs.find(
        (d) => d.target_name.toLowerCase() === lowerName
      )?.target_name || lowerName;
      entries.push({
        target_name: origName,
        total_weight: data.total_weight,
        total_votes: data.total_votes,
        total_paid: data.total_paid,
        last_nominated_at: data.last_nominated_at,
      });
    }

    entries.sort((a, b) => b.total_weight - a.total_weight);

    return entries;
  } catch (err) {
    console.error("fetchLeaderboard error:", err);
    return [];
  }
}

// ─── Server-side traitors fetch (used by Class Traitors component) ───────────

export async function fetchTraitors(): Promise<import("../../lib/types").TraitorEntry[]> {
  try {
    const db = getDb();
    const rawDb = getRawDb();
    const treasuryWallet = (process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET || "").toLowerCase();

    const paidProfiles = getPaidWalletProfiles();

    const epochs = db.listDocuments("", "epochs", [Query.orderDesc("started_at"), Query.limit(1)]);
    if (epochs.documents.length === 0) return [];
    const raw = (epochs.documents[0] as any).board_members;
    if (!raw || raw === "[]") return [];

    let boardMembers: { wallet: string; balance: number; voted: boolean }[];
    try { boardMembers = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return []; }

    const entries: import("../../lib/types").TraitorEntry[] = [];
    for (const m of boardMembers) {
      const w = m.wallet.toLowerCase();
      if (paidProfiles.has(w)) continue;
      if (w === treasuryWallet) continue;

      const msgRow = rawDb.prepare(
        "SELECT COUNT(*) as cnt, MAX(created_at) as last_at FROM messages WHERE LOWER(author_id) = ? AND amount_paid = 0"
      ).get(w) as { cnt: number; last_at: string | null } | undefined;

      entries.push({ author_name: m.wallet, total_paid: m.balance, total_messages: msgRow?.cnt || 0, last_active_at: msgRow?.last_at || "" });
    }
    entries.sort((a, b) => b.total_paid - a.total_paid);
    return entries;
  } catch (err) { console.error("fetchTraitors error:", err); return []; }
}

// ─── Server-side benefactors fetch (users who PAID to fund the revolution) ───

export async function fetchBenefactors(): Promise<import("../../lib/types").BenefactorEntry[]> {
  try {
    const profiles = getPaidWalletProfiles();
    return Array.from(profiles.values())
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .map(p => ({ author_name: p.wallet, total_paid: p.totalPaid, message_count: p.messageCount, last_paid_at: p.lastActive }));
  } catch (err) { console.error("fetchBenefactors error:", err); return []; }
}
