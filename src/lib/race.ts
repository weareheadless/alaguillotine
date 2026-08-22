/**
 * race.ts — the-guillotine v2 race engine.
 *
 * Two candidates race on two boards. Position per board = sum of craft weights
 * (score 1-5; rejected messages count 0). The blade drops when the leader's
 * weighted lead exceeds 10% of the total weighted posts (both boards), checked
 * after every accepted message, real-time. On a drop the leader is decapitated
 * and leaves; the survivor stays and faces the next candidate from the roster
 * (a gauntlet — the action never stops).
 *
 * Capabilites also enforced here:
 *   - Swarm protection: hard cap on messages one target can take per hour.
 *   - Per-wallet cap: one account's bounded weight contribution per race.
 */

import { LocalDatabases, Query, getDb } from "./local-db";

// ─── Tunables ────────────────────────────────────────────────────────────────

export const LEAD_PCT = 0.1; // blade drops when lead > 10% of total weight
export const MIN_TOTAL_WEIGHT = 6; // blade stays cold until the race has this much total weight
export const SWARM_PER_TARGET_PER_HOUR = 50; // max messages one board takes / hr
export const WALLET_WEIGHT_CAP = 20; // max craft-weight one wallet can give a board in one race

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RaceState {
  raceId: string;
  candidateA: string;
  candidateB: string;
  weightA: number;
  weightB: number;
  totalWeight: number;
  leader: string | null; // null when tied
  leadWeight: number;
  leadPct: number;
  bladeLive: boolean; // true once total weight >= MIN_TOTAL_WEIGHT
  thresholdWeight: number; // the lead needed to drop (> 10% of total)
  willDrop: boolean; // true once lead exceeds the 10% threshold
  epochNumber: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDbClient() {
  return new LocalDatabases();
}

/** The single active race, or null if none. */
export function getActiveRace(): RaceState | null {
  const db = getDbClient();
  const races = db.listDocuments("", "races", [
    Query.equal("status", "active"),
    Query.limit(1),
  ]);
  if (races.documents.length === 0) return null;
  const r = races.documents[0] as Record<string, unknown>;
  return computeRaceState(r.id as string, r.candidate_a as string, r.candidate_b as string, Number(r.epoch_number ?? 1));
}

/** The active race's candidate names in (a, b) order, or null. */
export function getActiveRacePair(): { candidateA: string; candidateB: string; raceId: string } | null {
  const db = getDbClient();
  const races = db.listDocuments("", "races", [
    Query.equal("status", "active"),
    Query.limit(1),
  ]);
  if (races.documents.length === 0) return null;
  const r = races.documents[0] as Record<string, unknown>;
  return {
    raceId: r.id as string,
    candidateA: r.candidate_a as string,
    candidateB: r.candidate_b as string,
  };
}

/**
 * Compute weighted positions for both boards of a race from the messages table.
 * Only top-level (non-reply) accepted messages with a score count toward a race.
 */
export function computeRaceState(
  raceId: string,
  candidateA: string,
  candidateB: string,
  epochNumber: number
): RaceState {
  const rawDb = getDb();
  const rows = rawDb.prepare(
    `SELECT board, score FROM messages
     WHERE race_id = ? AND parent_id IS NULL AND is_shadowbanned = 0
     ORDER BY created_at ASC`
  ).all(raceId) as { board: string; score: number }[];

  let weightA = 0;
  let weightB = 0;
  for (const row of rows) {
    const w = Math.max(0, Number(row.score) || 0);
    if (row.board === "b") weightB += w;
    else weightA += w;
  }

  const totalWeight = weightA + weightB;
  const leadWeight = Math.abs(weightA - weightB);
  const leadPct = totalWeight > 0 ? leadWeight / totalWeight : 0;
  // The blade stays cold until the race has enough total weight to be a real
  // race — otherwise a single good message (100% lead of a tiny total) would
  // drop instantly. Once live, drop when lead > 10% of total.
  const bladeLive = totalWeight >= MIN_TOTAL_WEIGHT;
  const willDrop = bladeLive && leadWeight > LEAD_PCT * totalWeight;

  return {
    raceId,
    candidateA,
    candidateB,
    weightA,
    weightB,
    totalWeight,
    leader: weightA === weightB ? null : weightA > weightB ? candidateA : candidateB,
    leadWeight,
    leadPct,
    bladeLive,
    thresholdWeight: LEAD_PCT * totalWeight,
    willDrop,
    epochNumber,
  };
}

/**
 * Record an accepted message into the active race and re-check the drop.
 * Returns the updated race state plus whether the blade dropped.
 *
 * On a drop: mark the race over (decapitated = leader, survivor = chaser),
 * move the decapitated candidate to roster.status = 'decapitated', and start
 * the next race with the survivor vs the next active candidate in rank order.
 */
export function recordAcceptedMessage(
  messageId: string,
  board: "a" | "b",
  score: number,
  opts: { authorId?: string | null; amountPaid?: number; now?: Date } = {}
): { state: RaceState; dropped: boolean; decapitated?: string; survivor?: string } {
  const now = opts.now ?? new Date();
  const race = getActiveRacePair();
  if (!race) {
    return { state: computeRaceState("", "", "", 1), dropped: false };
  }

  const rawDb = getDb();
  rawDb.prepare(
    `UPDATE messages SET race_id = ?, board = ?, score = ? WHERE id = ?`
  ).run(race.raceId, board, Math.max(0, Math.min(5, Math.floor(score) || 0)), messageId);

  const state = computeRaceState(race.raceId, race.candidateA, race.candidateB, currentEpochNumber());

  if (!state.willDrop) {
    return { state, dropped: false };
  }

  // ── Drop: leader loses their head, survivor holds the board ──────────────
  const decapitated = state.leader as string;
  const survivor = decapitated === race.candidateA ? race.candidateB : race.candidateA;

  // Close the race.
  rawDb.prepare(
    `UPDATE races SET status = 'over', ended_at = ?, decapitated = ?, survivor = ?,
       trigger_lead = ?, total_weight = ? WHERE id = ?`
  ).run(now.toISOString(), decapitated, survivor, Math.round(state.leadWeight), state.totalWeight, race.raceId);

  // Mark the loser out of the roster.
  rawDb.prepare(`UPDATE roster SET status = 'decapitated' WHERE name = ?`).run(decapitated);

  // Start the next race: survivor vs next active candidate by rank.
  const next = rawDb.prepare(
    `SELECT name, rank FROM roster WHERE status = 'active' AND name != ? ORDER BY rank ASC LIMIT 1`
  ).get(survivor) as { name: string; rank: number } | undefined;

  if (next) {
    const nextRaceId = `race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    rawDb.prepare(
      `INSERT INTO races (id, candidate_a, candidate_b, status, started_at, epoch_number, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`
    ).run(nextRaceId, survivor, next.name, now.toISOString(), state.epochNumber, now.toISOString());
  } else {
    // Every candidate has been decapitated — re-arm the roster so the game
    // never gets stuck with no one left to race. The survivor holds the board
    // and the cycle starts again.
    rawDb.prepare(`UPDATE roster SET status = 'active'`).run();
    rawDb.prepare(`UPDATE roster SET status = 'decapitated' WHERE name = ?`).run(survivor);
    const first = rawDb.prepare(
      `SELECT name FROM roster WHERE status = 'active' AND name != ? ORDER BY rank ASC LIMIT 1`
    ).get(survivor) as { name: string } | undefined;
    if (first) {
      const nextRaceId = `race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      rawDb.prepare(
        `INSERT INTO races (id, candidate_a, candidate_b, status, started_at, epoch_number, created_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`
      ).run(nextRaceId, survivor, first.name, now.toISOString(), state.epochNumber, now.toISOString());
    }
  }

  const newState = computeRaceState(
    race.raceId,
    race.candidateA,
    race.candidateB,
    state.epochNumber
  );

  return { state: newState, dropped: true, decapitated, survivor };
}

function currentEpochNumber(): number {
  const db = getDbClient();
  const epochs = db.listDocuments("", "epochs", [Query.orderDesc("started_at"), Query.limit(1)]);
  if (epochs.documents.length === 0) return 1;
  return Number((epochs.documents[0] as any).epoch_number || 1);
}

// ─── Caps ───────────────────────────────────────────────────────────────────

/**
 * Swarm protection: how many messages has this target/board already taken
 * within the rolling hour? If at/over the cap, block new posts to that board.
 */
export function targetSwarmCount(board: "a" | "b", withinMs = 60 * 60 * 1000): number {
  const race = getActiveRacePair();
  if (!race) return 0;
  const rawDb = getDb();
  const since = new Date(Date.now() - withinMs).toISOString();
  const row = rawDb.prepare(
    `SELECT COUNT(*) as n FROM messages
     WHERE race_id = ? AND board = ? AND parent_id IS NULL AND is_shadowbanned = 0
       AND created_at >= ?`
  ).get(race.raceId, board, since) as { n: number };
  return row?.n ?? 0;
}

export function swarmAllowed(board: "a" | "b"): boolean {
  return targetSwarmCount(board) < SWARM_PER_TARGET_PER_HOUR;
}

/**
 * Per-wallet cap: total craft weight this author has already given to this
 * board in this race. A single account can't manufacture a 10% lead.
 */
export function walletWeightUsed(board: "a" | "b", authorId: string | null | undefined): number {
  if (!authorId) return 0;
  const race = getActiveRacePair();
  if (!race) return 0;
  const rawDb = getDb();
  const row = rawDb.prepare(
    `SELECT COALESCE(SUM(score), 0) as w FROM messages
     WHERE race_id = ? AND board = ? AND parent_id IS NULL
       AND author_id = ? AND is_shadowbanned = 0`
  ).get(race.raceId, board, authorId) as { w: number };
  return row?.w ?? 0;
}

export function walletWeightAllowed(board: "a" | "b", authorId: string | null | undefined, score: number): boolean {
  return walletWeightUsed(board, authorId) + score <= WALLET_WEIGHT_CAP;
}
