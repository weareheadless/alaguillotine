import {
  bladePct,
  emptyClock,
  formatCountdown,
  secondsToMidnight,
  type ClockState,
} from "@/lib/clock";
import { getDb, isStale, readAdPool, readClock } from "@/lib/clock-store";

export const revalidate = 0;

/**
 * GET /api/clock — the current reading.
 *
 * The row holds the model inputs. Every displayed number is recomputed here
 * from them, so the dial can never disagree with the data behind it.
 */
export async function GET() {
  try {
    const db = await getDb();
    if (!db) {
      return Response.json(emptyClock(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const row = await readClock(db);
    if (!row) {
      return Response.json(emptyClock(), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // The latest reading's ads are only part of the stack; the pool holds a
    // week of them.
    let ads = row.voice.ads;
    try {
      const pool = await readAdPool(db);
      if (pool.length) ads = pool;
    } catch {
      /* the pool table may not exist yet */
    }

    const seconds = secondsToMidnight(row.level);
    const state: ClockState = {
      level: row.level,
      composite: row.composite,
      pressure: Math.round((row.composite - row.level) * 100) / 100,
      dimensions: row.dimensions,
      secondsToMidnight: seconds,
      tMinus: formatCountdown(seconds),
      bladePct: bladePct(row.level),
      items: row.items,
      voice: { ...row.voice, ads },
      computedAt: row.computedAt,
      nextRunAt: new Date(Date.parse(row.computedAt) + 4 * 60 * 60 * 1000).toISOString(),
      queryCount: 8,
      stale: isStale(row.computedAt),
    };

    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("clock_read_failed", error instanceof Error ? error.message : "unknown");
    return Response.json(emptyClock(), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
