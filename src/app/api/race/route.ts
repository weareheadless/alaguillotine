import { getActiveRace, getActiveRacePair, type RaceState } from "@/lib/race";
import { getDb } from "@/lib/local-db";

export const revalidate = 0;

/**
 * GET /api/race — the live state of the the-guillotine v2 race.
 *
 * Returns the current race (candidate_a vs candidate_b), weighted positions,
 * the leader and their lead %, and whether the blade is about to drop, plus the
 * next candidate in the roster. The frontend polls this for the live board.
 */
export async function GET() {
  try {
    const state = getActiveRace();
    const pair = getActiveRacePair();

    // Next candidate in the roster (the one who faces the current survivor).
    let nextUp: { name: string; net_worth: string; emoji: string } | null = null;
    if (state) {
      const rawDb = getDb();
      // The next challenger = lowest-rank active candidate not currently racing.
      const row = rawDb.prepare(
        `SELECT name, net_worth, emoji FROM roster
         WHERE status = 'active' AND name NOT IN (?, ?)
         ORDER BY rank ASC LIMIT 1`
      ).get(pair?.candidateA ?? "", pair?.candidateB ?? "") as
        | { name: string; net_worth: string; emoji: string }
        | undefined;
      nextUp = row ?? null;
    }

    const payload = {
      race: state
        ? {
            raceId: state.raceId,
            candidateA: state.candidateA,
            candidateB: state.candidateB,
            weightA: state.weightA,
            weightB: state.weightB,
            totalWeight: state.totalWeight,
            leader: state.leader,
            leadWeight: state.leadWeight,
            leadPct: Math.round(state.leadPct * 1000) / 10,
            bladeLive: state.bladeLive,
            thresholdWeight: state.thresholdWeight,
            willDrop: state.willDrop,
            epochNumber: state.epochNumber,
          }
        : null,
      nextUp,
      fetchedAt: new Date().toISOString(),
    };
    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("race route error:", err);
    return Response.json({ race: null, nextUp: null, error: "race unavailable" }, { status: 500 });
  }
}
