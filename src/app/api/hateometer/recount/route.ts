import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ledgerSummaryFor, readLedgerSummaries } from "@/lib/archive-store";
import { getDb, readQueue } from "@/lib/hate-store";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

/**
 * POST /api/hateometer/recount — rewrite the queue's numbers from the ledger.
 *
 * The score is computed from the ledger, but it is stored on the queue row by
 * the research pass. When the arithmetic itself changes — the five-worst rule
 * replaced the sum — the stored numbers are wrong until the next pass, and the
 * blade would be choosing on an old formula. This recomputes without calling a
 * model: no new names, no new charges, just the number the record earns.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { CRON_SECRET?: string };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const [queue, summaries] = await Promise.all([readQueue(db), readLedgerSummaries()]);

  let updated = 0;
  let dropped = 0;
  const moved: Array<{ name: string; from: number; to: number }> = [];

  for (const person of queue) {
    const summary = ledgerSummaryFor(summaries, person.name);
    const score = summary?.evidence ?? 0;
    // A name whose only claims are pending has no accepted record at all: it
    // leaves the line with them, rather than sitting at zero as if acquitted.
    // A name with a real but aged record stays, below the ranking.
    if ((summary?.count ?? 0) === 0) {
      await db
        .prepare("DELETE FROM queue_people WHERE slug = ?")
        .bind(slugify(person.name))
        .run();
      dropped += 1;
      continue;
    }
    if (Math.abs(score - person.score) < 0.05) continue;
    await db
      .prepare("UPDATE queue_people SET score = ? WHERE slug = ?")
      .bind(score, slugify(person.name))
      .run();
    updated += 1;
    moved.push({ name: person.name, from: person.score, to: score });
  }

  moved.sort((a, b) => b.from - b.to);
  return Response.json({
    ok: true,
    names: queue.length,
    updated,
    dropped,
    moved: moved.slice(0, 12),
  });
}
