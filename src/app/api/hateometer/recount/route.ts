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
  const moved: Array<{ name: string; from: number; to: number }> = [];

  for (const person of queue) {
    const score = ledgerSummaryFor(summaries, person.name)?.evidence ?? 0;
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
    moved: moved.slice(0, 12),
  });
}
