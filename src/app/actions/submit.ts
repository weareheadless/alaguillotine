"use server";

import crypto from "crypto";
import { Connection } from "@solana/web3.js";
import type { SubmitFreeResponse, SubmitPaidResponse } from "../../lib/types";
import { NOMINATION_WEIGHT_FREE, NOMINATION_WEIGHT_MULTIPLIER } from "../../lib/types";
import { ensureEpoch, checkEpochTransition, getBurnPerMessage } from "./epoch";
import { LocalDatabases, Query, getDb as getRawDb } from "../../lib/local-db";
import { getSessionUserId, getClientIp, createSession } from "../../lib/session";
import { getUserById, createGuestUser } from "../../lib/users";
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

// ─── Guest posting rate limits (per IP, rolling window) ────────────────────────

const GUEST_MSG_LIMIT = 3; // top-level free messages per hour per IP
const GUEST_COMMENT_LIMIT = 10; // comments per hour per IP
const GUEST_WINDOW_HOURS = 1;

function guestPostsInWindow(ip: string, kind: string, windowHours: number): number {
  const rawDb = getRawDb();
  const row = rawDb.prepare(
    `SELECT COUNT(*) as n FROM guest_posts WHERE ip = ? AND kind = ? AND created_at > datetime('now', ?)`
  ).get(ip, kind, `-${windowHours} hours`) as { n: number } | undefined;
  return row?.n ?? 0;
}

function logGuestPost(ip: string, kind: string, messageId: string): void {
  const rawDb = getRawDb();
  rawDb.prepare(
    `INSERT INTO guest_posts (id, ip, kind, message_id, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), ip, kind, messageId, new Date().toISOString());
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
      // Never let moderation block a post — if OpenAI is slow, skip moderation
      signal: AbortSignal.timeout(8_000),
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

    const isGuest = !!user.is_guest;
    const authorId = user.id;
    const authorName = customName || user.display_name || user.username || "Anonymous";

    // PoW verification — skip for wallet-linked users and guests (guests are rate-limited by IP)
    if (!isGuest && !user.wallet_address) {
      const powValid = await verifyPow(formData);
      if (!powValid) {
        return { success: false, error: "Proof of work invalid or expired. Refresh and try again." };
      }
    }

    const db = getDb();

    if (isGuest) {
      // Guests: rate-limit by IP instead of the one-per-user rule
      const ip = await getClientIp();
      if (guestPostsInWindow(ip, "message", GUEST_WINDOW_HOURS) >= GUEST_MSG_LIMIT) {
        return { success: false, error: "Slow down, citizen. 3 free messages per hour." };
      }
    } else {
      // Check one-message-per-user limit (only for top-level messages)
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

    // Track guest rate limit
    if (isGuest) {
      logGuestPost(await getClientIp(), "message", (msgDoc as any).id);
    }

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

// ─── Submit Guest Message (anonymous — no login, rate-limited by IP) ───────────

export async function submitGuestMessage(formData: FormData): Promise<SubmitFreeResponse> {
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

    const ip = await getClientIp();

    // Rate limit top-level guest messages per IP
    if (guestPostsInWindow(ip, "message", GUEST_WINDOW_HOURS) >= GUEST_MSG_LIMIT) {
      return { success: false, error: "Slow down, citizen. 3 free messages per hour." };
    }

    // Reuse existing session (returning guest) or create a guest identity
    let userId = await getSessionUserId();
    let user = userId ? getUserById(userId) : null;

    if (!user) {
      user = createGuestUser(customName || "Anonymous Spite");
      await createSession(user.id);
      userId = user.id;
    }

    const authorId = user.id;
    const authorName = customName || user.display_name || user.username || "Anonymous";

    // Check moderation (shadowban)
    const isShadowbanned = await checkModeration(text);

    const db = getDb();

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

    logGuestPost(ip, "message", (msgDoc as any).id);

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
    console.error("submitGuestMessage error:", err);
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

    // Get session user — auto-create a guest identity if there's no session
    const ip = await getClientIp();
    let userId = await getSessionUserId();
    let user = userId ? getUserById(userId) : null;

    if (!user) {
      user = createGuestUser(customName || "Anonymous Spite");
      await createSession(user.id);
    }

    const isGuest = !!user.is_guest;
    const authorId = user.id;
    const authorName = customName || user.display_name || user.username || "Anonymous";

    // PoW verification — skip for wallet-linked users and guests (guests are rate-limited by IP)
    if (!isGuest && !user.wallet_address) {
      const powValid = await verifyPow(formData);
      if (!powValid) {
        return { success: false, error: "Proof of work invalid or expired. Refresh and try again." };
      }
    }

    // Guests: rate-limit comments by IP
    if (isGuest) {
      if (guestPostsInWindow(ip, "comment", GUEST_WINDOW_HOURS) >= GUEST_COMMENT_LIMIT) {
        return { success: false, error: "Slow down, citizen. 10 replies per hour." };
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

    // Track guest rate limit
    if (isGuest) {
      logGuestPost(ip, "comment", (commentDoc as any).id);
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

// ─── Server-side benefactors fetch (users who PAID to fund the revolution) ───

export async function fetchBenefactors(): Promise<import("../../lib/types").BenefactorEntry[]> {
  try {
    const profiles = getPaidWalletProfiles();
    return Array.from(profiles.values())
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .map(p => ({ author_name: p.wallet, total_paid: p.totalPaid, message_count: p.messageCount, last_paid_at: p.lastActive }));
  } catch (err) { console.error("fetchBenefactors error:", err); return []; }
}
