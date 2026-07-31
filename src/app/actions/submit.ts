"use server";

import { Connection } from "@solana/web3.js";
import type { SubmitFreeResponse, SubmitPaidResponse, NominationEntry } from "../../lib/types";
import { NOMINATION_WEIGHT_FREE, NOMINATION_WEIGHT_MULTIPLIER } from "../../lib/types";
import { ensureEpoch, checkEpochTransition, getBurnPerMessage } from "./epoch";
import { LocalDatabases, Query, getDb as getRawDb } from "../../lib/local-db";
import { getSessionUserId } from "../../lib/session";
import { getUserById } from "../../lib/users";
import { verifySolution } from "../../lib/pow";
import { burnCHOP, CHOP_UNIT, getRpcUrl, verifyChopPayment } from "../../lib/solana";

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

// ─── Burn for Free Message ──────────────────────────────────────────────────────

/**
 * Burn the oracle-defined amount of CHOP for a free message.
 * Single source of truth: getBurnPerMessage() from epoch.ts + burnCHOP() from solana.ts.
 */
async function burnForFreeMessage(): Promise<string | null> {
  // Oracle-defined burn rate
  let burnPerMessage: number;
  try {
    burnPerMessage = await getBurnPerMessage();
  } catch {
    console.warn("[CHOP] Failed to fetch burn-per-message — skipping burn");
    return null;
  }

  if (burnPerMessage <= 0) {
    console.warn("[CHOP] Oracle burn rate is 0 — skipping burn");
    return null;
  }

  const amountRaw = BigInt(Math.floor(burnPerMessage * CHOP_UNIT));
  if (amountRaw <= BigInt(0)) return null;

  const connection = new Connection(getRpcUrl());
  return burnCHOP(connection, amountRaw);
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

    // Burn oracle-defined CHOP from treasury for this free message
    const burnTx = await burnForFreeMessage();

    // Ensure epoch exists + check if threshold crossed
    ensureEpoch();
    checkEpochTransition();

    return { success: true, burnTx: burnTx || undefined };
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

    // Burn oracle-defined CHOP from treasury for this free comment
    const burnTx = await burnForFreeMessage();

    // Ensure epoch exists + check if threshold crossed
    ensureEpoch();
    checkEpochTransition();

    return { success: true, burnTx: burnTx || undefined };
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
