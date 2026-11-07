import { emptyHate, type HateState } from "@/lib/hateometer";
import { getDb, readHate, readQueue } from "@/lib/hate-store";

export const revalidate = 0;

/** GET /api/hateometer — the queue and its counters. */
export async function GET() {
  try {
    const db = await getDb();
    if (!db) return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });

    const row = await readHate(db);
    const queue = await readQueue(db);
    if (!row && queue.length === 0) {
      return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });
    }

    const state: HateState = {
      level: row?.level ?? 0,
      composite: row?.composite ?? 0,
      pressure: row ? Math.round((row.composite - row.level) * 100) / 100 : 0,
      dimensions: row?.dimensions ?? emptyHate().dimensions,
      figures: queue.length ? queue : (row?.figures ?? []),
      computedAt: row?.computedAt ?? null,
      nextRunAt: row
        ? new Date(Date.parse(row.computedAt) + 12 * 60 * 60 * 1000).toISOString()
        : null,
      stale: row ? Date.now() - Date.parse(row.computedAt) > 36 * 60 * 60 * 1000 : true,
    };

    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("hate_read_failed", error instanceof Error ? error.message : "unknown");
    return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });
  }
}
