"use server";

import { createSession, getSessionUserId } from "../../lib/session";
import { createGuestUser, getUserById } from "../../lib/users";
import { getDb } from "../../lib/local-db";
import { getActiveRacePair, recordAcceptedMessage, swarmAllowed, walletWeightAllowed } from "../../lib/race";
import { verifyChopPayment } from "../../lib/solana";

// Where the bot's validate endpoint lives (internal). Overridable via env.
const VALIDATE_URL = process.env.BOT_VALIDATE_URL || "http://127.0.0.1:3005/validate";

// ─── Idempotency / dedup ─────────────────────────────────────────────────────
// Closes the double-click race: a second identical (author + text) submission
// within the window is treated as an "already sent" duplicate, never a new row.
// An in-memory map guards the same-process race even before the first insert
// lands (better-sqlite3 is synchronous, but server actions may run in separate
// workers); a lightweight DB query catches duplicates across restarts/workers.
const DEDUP_WINDOW_MS = 60_000;
const recentSubmissions = new Map<string, number>(); // key -> first seen (ms)

function pruneRecentSubmissions(now = Date.now()) {
  const cutoff = now - DEDUP_WINDOW_MS;
  for (const [key, seen] of recentSubmissions) {
    if (seen < cutoff) recentSubmissions.delete(key);
  }
}

/** Returns true if this key was already seen within the window (and re-marks it). */
function markDuplicate(key: string): boolean {
  pruneRecentSubmissions();
  const now = Date.now();
  if (recentSubmissions.has(key)) return true;
  recentSubmissions.set(key, now);
  return false;
}

export interface RaceSubmitResponse {
  success: boolean;
  error?: string;
  id?: string;
  authorName?: string;
  score?: number;
  reason?: string;
  quip?: string;
  dropped?: boolean;
  decapitated?: string;
  survivor?: string;
}

export interface RaceMessage {
  id: string;
  text: string;
  author_name: string;
  score: number;
  amount_paid: number;
  created_at: string;
}

export async function fetchRaceMessages(raceId: string, board: "a" | "b"): Promise<RaceMessage[]> {
  try {
    const db = getDb();
    return db.prepare(
      `SELECT id, text, author_name, score, amount_paid, created_at
       FROM messages
       WHERE race_id = ? AND board = ? AND parent_id IS NULL AND is_shadowbanned = 0
       ORDER BY created_at DESC LIMIT 30`
    ).all(raceId, board) as RaceMessage[];
  } catch (err) {
    console.error("fetchRaceMessages error:", err);
    return [];
  }
}

/**
 * Submit a message to the-guillotine v2 race.
 *
 * Flow: validate (bot AI: line-check + craft score) → if accepted, record into
 * the active race (sets race_id/board/score, re-checks the 10% drop) → return
 * the result. The site stays dumb; all AI + cost live in the bot.
 */
export async function submitRaceMessage(
  prev: RaceSubmitResponse,
  formData: FormData
): Promise<RaceSubmitResponse> {
  try {
    const text = (formData.get("text")?.toString() || "").trim();
    const board = (formData.get("board")?.toString() || "a") as "a" | "b";
    const requestedName = (formData.get("author_name")?.toString() || "").trim().slice(0, 30);
    if (!text) return { success: false, error: "Message is required." };

    const pair = getActiveRacePair();
    if (!pair) return { success: false, error: "No active race right now." };

    // Swarm protection: a target that's already absorbing too much can't take more.
    if (!swarmAllowed(board)) {
      return { success: false, error: "That neck's already in the basket — the crowd hit this target's cap for the hour. Post to the other board." };
    }

    // Identity for the per-wallet cap.
    let userId: string | null = null;
    let userName = "Anonymous Spite";
    try {
      userId = await getSessionUserId();
      let user = userId ? getUserById(userId) : null;
      if (!user) {
        user = createGuestUser(requestedName || "Anonymous Spite");
        await createSession(user.id);
      }
      userId = user.id;
      userName = requestedName || user.display_name || userName;
    } catch {
      /* Keep the post usable if anonymous session creation is unavailable. */
    }

    // AI validation + craft score from the bot.
    const vres = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!vres.ok) {
      return { success: false, error: "The referee is unavailable — try again in a moment." };
    }
    const v = (await vres.json()) as { accepted: boolean; score: number; reason: string; quip?: string };
    if (!v.accepted || !v.score) {
      return { success: false, error: v.reason || "The referee turned it down." };
    }
    const score = Math.max(1, Math.min(5, Math.floor(v.score || 0)));

    // Per-wallet cap: one account can't flood a board with craft weight.
    if (userId && !walletWeightAllowed(board, userId, score)) {
      return { success: false, error: "You've already poured enough weight into that board this race — let someone else swing." };
    }

    // Idempotency: reject a duplicate (same author + identical text) within the
    // short window — closes the double-click even if the client guard is bypassed.
    const dedupKey = `${userId ?? ""}::${text}`;
    const rawDb = getDb();
    if (markDuplicate(dedupKey)) {
      return { success: false, error: "Already sent — one swing is enough." };
    }
    const sinceIso = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const dupRow = userId
      ? rawDb.prepare(
          `SELECT id FROM messages WHERE created_at >= ? AND text = ? AND author_id = ? AND parent_id IS NULL LIMIT 1`
        ).get(sinceIso, text, userId)
      : rawDb.prepare(
          `SELECT id FROM messages WHERE created_at >= ? AND text = ? AND author_name = ? AND parent_id IS NULL LIMIT 1`
        ).get(sinceIso, text, userName);
    if (dupRow) {
      return { success: false, error: "Already sent — one swing is enough." };
    }

    // Insert the message, then record it into the race (sets score + re-checks drop).
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    rawDb.prepare(
      `INSERT INTO messages (id, text, author_id, author_name, amount_paid, is_shadowbanned, parent_id, created_at)
       VALUES (?, ?, ?, ?, 0, 0, NULL, ?)`
    ).run(msgId, text, userId, userName, now);

    const result = recordAcceptedMessage(msgId, board, score, { authorId: userId, now: new Date(now) });

    return {
      success: true,
      id: msgId,
      score,
      reason: v.reason,
      quip: v.quip,
      dropped: result.dropped,
      decapitated: result.decapitated,
      survivor: result.survivor,
    };
  } catch (err) {
    console.error("submitRaceMessage error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Paid race post: the wallet transfer is verified first, then the paid message
 * enters the same board/score pipeline as a free shot.
 */
export async function submitPaidRaceMessage(
  _prev: RaceSubmitResponse,
  formData: FormData,
): Promise<RaceSubmitResponse> {
  try {
    const text = (formData.get("text")?.toString() || "").trim();
    const board = (formData.get("board")?.toString() || "a") as "a" | "b";
    const amountPaid = Number.parseFloat(formData.get("amount_paid")?.toString() || "0");
    const txSignature = formData.get("tx_signature")?.toString().trim();
    const walletAddress = formData.get("wallet_address")?.toString().trim() || "";
    const requestedName = formData.get("author_name")?.toString().trim().slice(0, 50) || "";

    if (!text) return { success: false, error: "Message is required." };
    if (!amountPaid || amountPaid <= 0) return { success: false, error: "Payment amount must be greater than 0." };
    if (!txSignature) return { success: false, error: "Transaction signature is required." };

    const pair = getActiveRacePair();
    if (!pair) return { success: false, error: "No active race right now." };
    if (!swarmAllowed(board)) return { success: false, error: "That board has reached its hourly cap." };

    const verified = await verifyChopPayment(txSignature);
    const actualAmount = Math.min(amountPaid, verified.amount);
    if (!actualAmount || actualAmount <= 0) return { success: false, error: "No CHOP payment was verified." };

    // A payment is wallet-only by default. It becomes an account post only
    // when the user explicitly authenticated and linked this exact wallet.
    let authorId = verified.sender || walletAddress;
    let authorName = requestedName || "Anonymous Whale";
    try {
      const sessionUserId = await getSessionUserId();
      const sessionUser = sessionUserId ? getUserById(sessionUserId) : null;
      const paymentWallet = verified.sender || walletAddress;
      if (sessionUser?.wallet_address && sessionUser.wallet_address === paymentWallet) {
        authorId = sessionUser.id;
        authorName = requestedName || sessionUser.display_name || authorName;
      }
    } catch {
      /* Wallet-only attribution remains valid if session lookup fails. */
    }

    // Paid posts are never silently rejected after a confirmed transfer. If
    // the referee is unavailable, keep the message visible with minimum weight.
    let score = 1;
    try {
      const vres = await fetch(VALIDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: AbortSignal.timeout(30_000),
      });
      if (vres.ok) {
        const v = (await vres.json()) as { score?: number };
        score = Math.max(1, Math.min(5, Math.floor(v.score || 1)));
      }
    } catch {
      /* The paid message still gets displayed after payment confirmation. */
    }

    const rawDb = getDb();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    rawDb.prepare(
      `INSERT INTO messages (id, text, author_id, author_name, amount_paid, is_shadowbanned, parent_id, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
    ).run(msgId, text, authorId, authorName, actualAmount, now);

    const result = recordAcceptedMessage(msgId, board, score, { authorId, amountPaid: actualAmount, now: new Date(now) });
    return {
      success: true,
      id: msgId,
      authorName,
      score,
      dropped: result.dropped,
      decapitated: result.decapitated,
      survivor: result.survivor,
    };
  } catch (err) {
    console.error("submitPaidRaceMessage error:", err);
    return { success: false, error: "Something went wrong verifying the CHOP payment." };
  }
}
