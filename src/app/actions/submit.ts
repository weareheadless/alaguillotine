"use server";

import { Client, Account } from "node-appwrite";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import type { SubmitFreeResponse, SubmitPaidResponse, SubmitNominationResponse, NominationEntry } from "../../lib/types";
import { NOMINATION_WEIGHT_FREE, NOMINATION_WEIGHT_MULTIPLIER } from "../../lib/types";
import { ensureEpoch, checkEpochTransition } from "./epoch";
import { LocalDatabases, Query } from "../../lib/local-db";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Client authenticated via JWT — for verifying the user */
function getJwtClient(jwt: string) {
  return new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
}

function getDb() {
  return new LocalDatabases();
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

const CHOP_MINT = new PublicKey(process.env.NEXT_PUBLIC_CHOP_MINT || "DTPZyd2HnDmLQfCGkFJ7ajVbw77maUVT7QVLE7Ltpump");
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
 * Verify a paid transaction on-chain and confirm it transferred CHOP
 * to the treasury wallet. Returns the transferred CHOP amount or 0.
 */
async function verifyChopPayment(txSignature: string): Promise<number> {
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const receiverStr = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET;
  if (!receiverStr) {
    console.error("[CHOP] No receiver wallet configured");
    return 0;
  }
  const receiver = new PublicKey(receiverStr);

  const verifyRes = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [txSignature, { encoding: "json", maxSupportedTransactionVersion: 0 }],
    }),
  });

  const txData = await verifyRes.json();
  if (txData.error) {
    console.error("[CHOP] Transaction verification failed:", txData.error);
    return 0;
  }

  const tx = txData.result;
  if (!tx) return 0;

  // Check post-token-balances for CHOP transfers to the treasury
  const postBalances = tx.meta?.postTokenBalances ?? [];
  let totalChop = 0;

  for (const balance of postBalances) {
    if (balance.mint === CHOP_MINT.toBase58() && balance.owner === receiver.toBase58()) {
      totalChop += Number(balance.uiTokenAmount?.uiAmount ?? 0);
    }
  }

  return totalChop;
}

// ─── Submit Free Message (Appwrite session required, one per user) ──────────────

export async function submitFreeMessage(formData: FormData): Promise<SubmitFreeResponse> {
  try {
    const text = formData.get("text")?.toString().trim();
    const jwt = formData.get("session_jwt")?.toString();
    const customName = formData.get("author_name")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();
    if (!text) return { success: false, error: "Message is required." };
    if (!jwt) {
      return { success: false, error: "You must be logged in to post a free message." };
    }

    // Verify JWT and get user
    const jwtClient = getJwtClient(jwt);
    const userAccount = new Account(jwtClient);
    let user;
    try {
      user = await userAccount.get();
    } catch {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const authorId = user.$id;
    // Use the custom display name if provided, otherwise fall back to account name
    const authorName = customName ||
      (user.name as string) ||
      (user.email as string) ||
      "Anonymous";

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
    const text = formData.get("text")?.toString().trim();
    const jwt = formData.get("session_jwt")?.toString();
    const customName = formData.get("author_name")?.toString().trim();
    const parentId = formData.get("parent_id")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();
    if (!text) return { success: false, error: "Comment text is required." };
    if (!parentId) return { success: false, error: "Missing parent message ID." };
    if (!jwt) {
      return { success: false, error: "You must be logged in to comment." };
    }

    // Verify JWT and get user
    const jwtClient = getJwtClient(jwt);
    const userAccount = new Account(jwtClient);
    let user;
    try {
      user = await userAccount.get();
    } catch {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const authorId = user.$id;
    const authorName = customName ||
      (user.name as string) ||
      (user.email as string) ||
      "Anonymous";

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
    const text = formData.get("text")?.toString().trim();
    const authorName = formData.get("author_name")?.toString().trim() || "Anonymous";
    const amountPaid = parseFloat(formData.get("amount_paid")?.toString() || "0");
    const txSignature = formData.get("tx_signature")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();

    if (!text) return { success: false, error: "Message is required." };
    if (!amountPaid || amountPaid <= 0) {
      return { success: false, error: "Payment amount must be greater than 0." };
    }
    if (!txSignature) {
      return { success: false, error: "Transaction signature is required." };
    }

    // Verify the CHOP transfer on-chain
    const verifiedChop = await verifyChopPayment(txSignature);
    if (verifiedChop <= 0) {
      return { success: false, error: "Could not verify CHOP payment on-chain. Make sure you sent $CHOP to the treasury address." };
    }

    // Use the actual on-chain amount so the user can't lie
    const actualAmount = verifiedChop;

    const db = getDb();

    // Check moderation (shadowban)
    const isShadowbanned = await checkModeration(text);

    const msgDoc = db.createDocument(
      "",
      "messages",
      "unique()",
      {
        text,
        author_id: null,
        author_name: authorName,
        amount_paid: actualAmount,
        is_shadowbanned: isShadowbanned,
        created_at: new Date().toISOString(),
      }
    );

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

    // Pull holders from the epoch's board_members (populated by discover-board.cjs)
    // These are on-chain $CHOP token holders — the Class Traitors
    const epochs = db.listDocuments(
      "",
      "epochs",
      [Query.orderDesc("started_at"), Query.limit(1)]
    );

    if (epochs.documents.length === 0) return [];

    const epoch = epochs.documents[0];
    const raw = (epoch as any).board_members;
    if (!raw || raw === "[]") return [];

    let boardMembers: { wallet: string; balance: number; voted: boolean }[];
    try {
      boardMembers = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }

    const entries: import("../../lib/types").TraitorEntry[] = boardMembers.map((m) => ({
      author_name: m.wallet,
      total_paid: m.balance,
      total_messages: 0,
      last_active_at: "",
    }));

    entries.sort((a, b) => b.total_paid - a.total_paid);

    return entries;
  } catch (err) {
    console.error("fetchTraitors error:", err);
    return [];
  }
}
