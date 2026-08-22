"use server";

import { getDb } from "../../lib/local-db";
import { getTreasuryBalance, getBurnPerMessage } from "./epoch";
import { fetchCHOPBurned } from "../../lib/solana";

export interface SidebarMetrics {
  /** Total CHOP tokens burnt across all executed epochs */
  totalBurnt: number;
  /** Current CHOP balance in the treasury wallet */
  treasuryBalance: number;
  /** Oracle-defined CHOP burnt per free message (stable across the epoch) */
  burnPerMessage: number;
  /** Total messages (visible, non-shadowbanned) */
  totalMessages: number;
  /** Messages in the current epoch */
  messagesThisEpoch: number;
  /** Current epoch number */
  epochNumber: number;
  /** Expected total messages in current epoch (threshold) */
  epochThreshold: number;
}

/** Fetch all sidebar metrics in one call */
export async function fetchSidebarMetrics(): Promise<SidebarMetrics> {
  const db = getDb();

  // 1. Total messages (visible)
  const msgRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM messages WHERE is_shadowbanned = 0")
    .get() as { cnt: number };

  // 2. Current active epoch
  const epoch = db
    .prepare(
      "SELECT * FROM epochs WHERE status IN ('active', 'voting') ORDER BY started_at DESC LIMIT 1"
    )
    .get() as {
      epoch_number: number;
      status: string;
      started_at: string;
      treasury_amount: number;
      start_msg_count: number;
      end_msg_count: number;
    } | undefined;

  const epochThreshold = epoch ? epoch.end_msg_count - epoch.start_msg_count : 0;

  // 3. Messages this epoch
  let messagesThisEpoch = 0;
  if (epoch) {
    const epochMsg = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM messages WHERE is_shadowbanned = 0 AND created_at >= ?"
      )
      .get(epoch.started_at) as { cnt: number };
    messagesThisEpoch = epochMsg.cnt;
  }

  // 4. Total burnt — real on-chain truth: initial supply − current supply.
  //    Every paid post, free-message burn, and treasury burn shrinks the
  //    supply, so the delta is exact and needs no per-epoch bookkeeping.
  let totalBurnt = 0;
  try {
    totalBurnt = await fetchCHOPBurned();
  } catch {
    // RPC unavailable — best-effort reconstruction so the sidebar never blanks.
    totalBurnt = _legacyTotalBurnt(db);
  }

  // 5. Treasury balance (on-chain)
  let treasuryBalance = 0;
  try {
    treasuryBalance = await getTreasuryBalance();
  } catch {
    // Fall back to DB value
    treasuryBalance = epoch?.treasury_amount ?? 0;
  }
  if (treasuryBalance === 0) {
    treasuryBalance = epoch?.treasury_amount ?? 0;
  }

  // 6. Burn per message — single source of truth (epoch.ts)
  const burnPerMessage = await getBurnPerMessage();

  return {
    totalBurnt: Math.round(totalBurnt),
    treasuryBalance,
    burnPerMessage,
    totalMessages: msgRow.cnt,
    messagesThisEpoch,
    epochThreshold,
    epochNumber: epoch?.epoch_number ?? 0,
  };
}

/**
 * Legacy best-effort estimate of total burned CHOP, used only when the RPC is
 * unreachable. Reconstructs epoch-level burns from the winning proposals'
 * burn percentages plus per-message burns. The on-chain supply delta in
 * fetchSidebarMetrics is the real source of truth; this is just a fallback.
 */
function _legacyTotalBurnt(db: ReturnType<typeof getDb>): number {
  let total = 0;
  const executedEpochs = db
    .prepare("SELECT * FROM epochs WHERE status = 'executed' ORDER BY epoch_number ASC")
    .all() as Array<{
      epoch_number: number;
      treasury_amount: number;
      start_msg_count: number;
      end_msg_count: number;
      started_at: string;
      id: string;
    }>;

  for (const execEpoch of executedEpochs) {
    const winner = db
      .prepare(
        "SELECT burn_pct FROM oracle_proposals WHERE epoch_number = ? AND status = 'won' LIMIT 1"
      )
      .get(execEpoch.epoch_number) as { burn_pct: number } | undefined;

    if (winner && execEpoch.treasury_amount > 0) {
      total += Math.floor((execEpoch.treasury_amount * winner.burn_pct) / 100);

      const epochThreshold = execEpoch.end_msg_count - execEpoch.start_msg_count;
      if (epochThreshold > 0) {
        const burnPerMsg = (execEpoch.treasury_amount * winner.burn_pct / 100) / epochThreshold;
        const epochMsgCount = db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM messages WHERE is_shadowbanned = 0 AND created_at >= ?"
          )
          .get(execEpoch.started_at) as { cnt: number };
        total += Math.floor(epochMsgCount.cnt * burnPerMsg);
      }
    }
  }
  return total;
}
