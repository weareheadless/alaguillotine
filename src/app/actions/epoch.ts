"use server";

import type { EpochDocument, EpochSummary } from "../../lib/types";
import { getEpochThreshold } from "../../lib/types";
import { LocalDatabases, Query } from "../../lib/local-db";
import { getDb as getRawDb } from "../../lib/local-db";
import { fetchTreasuryBalance } from "../../lib/solana";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getDb() {
  return new LocalDatabases();
}

// ─── Epoch Management ──────────────────────────────────────────────────────────

/** Fetch the live on-chain CHOP balance of the treasury wallet (delegates to solana.ts) */
export async function getTreasuryBalance(): Promise<number> {
  return fetchTreasuryBalance();
}

/**
 * SINGLE SOURCE OF TRUTH — Oracle-defined burn per free message.
 *
 * Computed as: (treasury_balance × burn_pct / 100) / epoch_expected_messages
 *
 * Uses the epoch threshold (end_msg_count - start_msg_count) as the divisor,
 * NOT the current message count — so the burn per message stays stable and
 * predictable throughout the entire epoch rather than spiking at the start.
 *
 * - burn_pct comes from the won proposal for this epoch, or averaged across
 *   active proposals if voting hasn't resolved yet.
 * - Returns 0 if there's no active epoch, no treasury, no messages, or no
 *   oracle proposals with a non-zero burn_pct.
 *
 * Used by:
 *   - submit.ts  → actual on-chain burn transaction amount
 *   - metrics.ts → sidebar "💰 Burn/msg" display
 */
export async function getBurnPerMessage(): Promise<number> {
  const db = getRawDb();

  // Current active/voting epoch
  const epoch = db
    .prepare(
      "SELECT epoch_number, status, started_at, start_msg_count, end_msg_count FROM epochs WHERE status IN ('active', 'voting') ORDER BY started_at DESC LIMIT 1"
    )
    .get() as {
      epoch_number: number;
      status: string;
      started_at: string;
      start_msg_count: number;
      end_msg_count: number;
    } | undefined;

  if (!epoch) return 0;

  // Expected messages in this epoch (threshold = end - start)
  const expectedMessages = epoch.end_msg_count - epoch.start_msg_count;
  if (expectedMessages <= 0) return 0;

  // Treasury balance (on-chain, falls back to 0)
  let treasuryBalance = 0;
  try {
    treasuryBalance = await getTreasuryBalance();
  } catch {
    // Fall back to DB-stored amount
    const e = db
      .prepare("SELECT treasury_amount FROM epochs WHERE epoch_number = ?")
      .get(epoch.epoch_number) as { treasury_amount: number } | undefined;
    treasuryBalance = e?.treasury_amount ?? 0;
  }
  if (treasuryBalance <= 0) return 0;

  // burn_pct: won proposal first, else average of active proposals
  let burnPct = 0;

  const won = db
    .prepare(
      "SELECT burn_pct FROM oracle_proposals WHERE epoch_number = ? AND status = 'won' AND is_none_option = 0 LIMIT 1"
    )
    .get(epoch.epoch_number) as { burn_pct: number } | undefined;

  if (won) {
    burnPct = won.burn_pct;
  } else {
    const active = db
      .prepare(
        "SELECT burn_pct FROM oracle_proposals WHERE epoch_number = ? AND status = 'active' AND is_none_option = 0"
      )
      .all(epoch.epoch_number) as Array<{ burn_pct: number }>;

    if (active.length === 0) return 0;
    burnPct = active.reduce((sum, p) => sum + p.burn_pct, 0) / active.length;
  }

  if (burnPct <= 0) return 0;

  const totalBurn = (treasuryBalance * burnPct) / 100;
  return totalBurn / expectedMessages;
}

/** Get the current active or voting epoch */
export async function getCurrentEpoch(): Promise<EpochSummary | null> {
  const db = getDb();

  try {
    const res = db.listDocuments("", "epochs", [
      Query.or([
        Query.equal("status", "active"),
        Query.equal("status", "voting"),
      ]),
      Query.orderDesc("created_at"),
      Query.limit(1),
    ]);

    if (res.documents.length === 0) {
      return null;
    }

    const doc = res.documents[0] as unknown as EpochDocument;
    return docToSummary(doc);
  } catch {
    return null;
  }
}

/** Try to get or create the current epoch */
export async function ensureEpoch(): Promise<EpochSummary | null> {
  const db = getDb();

  // Check for active or voting epoch
  try {
    const existing = db.listDocuments("", "epochs", [
      Query.or([
        Query.equal("status", "active"),
        Query.equal("status", "voting"),
      ]),
      Query.orderDesc("created_at"),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      return docToSummary(existing.documents[0] as unknown as EpochDocument);
    }

    // No active epoch — create one
    // Count total messages to determine epoch number
    const msgCount = db.listDocuments("", "messages", [
      Query.equal("is_shadowbanned", false),
      Query.limit(1),
    ]);

    const totalMessages = msgCount.total;

    // Find last executed epoch to determine next epoch number
    const lastExecuted = db.listDocuments("", "epochs", [
      Query.equal("status", "executed"),
      Query.orderDesc("created_at"),
      Query.limit(1),
    ]);

    const nextEpochNum = lastExecuted.documents.length > 0
      ? (lastExecuted.documents[0] as unknown as EpochDocument).epoch_number + 1
      : 1;

    const threshold = getEpochThreshold(nextEpochNum);

    const startMsgCount = lastExecuted.documents.length > 0
      ? (lastExecuted.documents[0] as unknown as EpochDocument).end_msg_count
      : 0;

    const epochDoc = db.createDocument(
      "",
      "epochs",
      "unique()",
      {
        epoch_number: nextEpochNum,
        status: "active",
        start_msg_count: startMsgCount,
        end_msg_count: startMsgCount + threshold,
        treasury_amount: 0,
        unique_senders: 0,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
    );

    return docToSummary(epochDoc as unknown as EpochDocument);
  } catch (err) {
    console.error("[Epoch] ensureEpoch error:", err);
    return null;
  }
}

/** Check if epoch threshold is crossed — if so, transition to voting */
export async function checkEpochTransition(): Promise<boolean> {
  const db = getDb();

  try {
    const active = db.listDocuments("", "epochs", [
      Query.equal("status", "active"),
      Query.limit(1),
    ]);

    if (active.documents.length === 0) return false;

    const epoch = active.documents[0] as unknown as EpochDocument;

    // Count current messages
    const msgCount = db.listDocuments("", "messages", [
      Query.equal("is_shadowbanned", false),
      Query.limit(1),
    ]);

    if (msgCount.total >= epoch.end_msg_count) {
      // Transition to voting — Oracle cron picks up from here
      db.updateDocument("", "epochs", (epoch as any).id, {
        status: "voting",
      });

      return true;
    }

    return false;
  } catch (err) {
    console.error("[Epoch] checkEpochTransition error:", err);
    return false;
  }
}

// ─── Finalize ───────────────────────────────────────────────────────────────────

export async function finalizeEpoch(epochNumber: number): Promise<void> {
  const db = getRawDb();

  const counts = db
    .prepare(
      `SELECT proposal_id, COUNT(*) as cnt FROM governance_votes
       WHERE epoch_number = ? GROUP BY proposal_id ORDER BY cnt DESC`
    )
    .all(epochNumber) as Array<{ proposal_id: string; cnt: number }>;

  if (counts.length === 0) {
    // No votes — default allocation
    applyDefault(epochNumber);
    return;
  }

  const winnerId = counts[0].proposal_id;
  const winner = db
    .prepare("SELECT * FROM oracle_proposals WHERE id = ?")
    .get(winnerId) as any;

  if (winner?.is_none_option) {
    // NONE OF THESE won — count how many times NONE has won for this epoch
    const noneWins = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM oracle_proposals
         WHERE epoch_number = ? AND is_none_option = 1 AND status = 'won'`
      )
      .get(epochNumber) as { cnt: number };

    db.prepare(
      "UPDATE oracle_proposals SET status='won', resolved_at=? WHERE id=?"
    ).run(new Date().toISOString(), winnerId);

    if (noneWins.cnt + 1 >= 3) {
      // Oracle fired — default allocation
      applyDefault(epochNumber);
    } else {
      // Expire old proposals so Oracle regenerates
      db.prepare(
        "UPDATE oracle_proposals SET status='expired' WHERE epoch_number=? AND status='active'"
      ).run(epochNumber);
    }
    return;
  }

  // A real plan won
  db.prepare(
    "UPDATE oracle_proposals SET status='won', resolved_at=? WHERE id=?"
  ).run(new Date().toISOString(), winnerId);
  db.prepare(
    "UPDATE oracle_proposals SET status='lost' WHERE epoch_number=? AND id!=? AND status='active'"
  ).run(epochNumber, winnerId);

  // Mark epoch as executed
  const epoch = db
    .prepare("SELECT id FROM epochs WHERE epoch_number = ? AND status = 'voting'")
    .get(epochNumber) as { id: string } | undefined;
  if (epoch) {
    db.prepare("UPDATE epochs SET status='executed' WHERE id=?").run(epoch.id);
  }
}

async function applyDefault(epochNumber: number): Promise<void> {
  const db = getRawDb();

  // Expire remaining active proposals
  db.prepare(
    "UPDATE oracle_proposals SET status='expired' WHERE epoch_number=? AND status='active'"
  ).run(epochNumber);

  // Mark epoch executed
  const epoch = db
    .prepare("SELECT id FROM epochs WHERE epoch_number = ? AND status = 'voting'")
    .get(epochNumber) as { id: string } | undefined;
  if (epoch) {
    db.prepare("UPDATE epochs SET status='executed' WHERE id=?").run(epoch.id);
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────────

function docToSummary(doc: EpochDocument): EpochSummary {
  return {
    epoch_number: doc.epoch_number,
    status: doc.status,
    started_at: doc.started_at,
    total_messages: doc.end_msg_count - doc.start_msg_count,
    treasury_amount: doc.treasury_amount,
  };
}
