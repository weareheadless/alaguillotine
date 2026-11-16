import { buildHateState } from "@/lib/hate-state";
import { emptyHate } from "@/lib/hateometer";
import { getDb, readHate, readLastExecution, readSentence } from "@/lib/hate-store";

export const revalidate = 0;
export const dynamic = "force-dynamic";

/**
 * GET /api/hateometer — the queue and its counters.
 *
 * `?lean=1` answers with the appointment alone, for the strip in the navbar:
 * the full reading is 300 KB and the strip reads one name and one time out of
 * it. The front page does not call either endpoint any more — it renders the
 * reading on the server — so this is for the pages that only carry the strip,
 * and for the page's own refresh after it has loaded.
 */
export async function GET(request: Request) {
  try {
    const db = await getDb();
    if (!db) return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });

    if (new URL(request.url).searchParams.get("lean") === "1") {
      // Sentencing and execution are the cron's job; this only reads what it
      // wrote.
      const [sentence, row] = await Promise.all([readSentence(db), readHate(db)]);
      const state = {
        ...emptyHate(),
        level: row?.level ?? 0,
        composite: row?.composite ?? 0,
        computedAt: row?.computedAt ?? null,
        stale: row ? Date.now() - Date.parse(row.computedAt) > 36 * 60 * 60 * 1000 : true,
        figures: (row?.figures ?? []).map((f) => ({
          name: f.name,
          role: f.role,
          country: f.country,
          score: f.score,
          reason: f.reason,
        })),
        execution: sentence
          ? {
              ...sentence,
              secondsLeft: Math.max(
                0,
                Math.round((Date.parse(sentence.executeAt) - Date.now()) / 1000),
              ),
            }
          : null,
        lastExecution: sentence ? null : await readLastExecution(db),
      };
      return Response.json(state, {
        headers: { "Cache-Control": "public, max-age=10, s-maxage=15" },
      });
    }

    const state = await buildHateState(db);
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("hate_read_failed", error instanceof Error ? error.message : "unknown");
    return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });
  }
}
