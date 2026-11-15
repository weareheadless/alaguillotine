import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ingestFindings, type IngestTally } from "@/lib/findings-ingest";
import { OUTLETS, QUERIES } from "@/lib/findings";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/findings/refresh — one step of the automated pass.
 *
 * The grid is every outlet crossed with every finding word. Each run takes the
 * next pair, so the machine keeps reading without a list of names. A pair that
 * fails does not stop the cursor: the next run moves on and a later cycle
 * retries it.
 */

const PER = 15;

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as { env?: Env };
  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const pairs = OUTLETS.flatMap((outlet) => QUERIES.map((query) => ({ outlet: outlet.key, query })));
  const row = await db
    .prepare("SELECT position FROM findings_cursor WHERE id = 1 LIMIT 1")
    .first<{ position: number }>();
  const start = Math.max(0, Number(row?.position ?? 0)) % pairs.length;
  const take = Math.max(1, Math.min(3, Number(new URL(request.url).searchParams.get("take") ?? 1)));
  const now = new Date().toISOString();
  const results: Array<IngestTally | { outlet: string; query: string; error: string }> = [];

  for (let i = 0; i < take; i += 1) {
    const pair = pairs[(start + i) % pairs.length];
    try {
      results.push(await ingestFindings(db, pair.outlet, pair.query, PER));
    } catch (error) {
      results.push({ outlet: pair.outlet, query: pair.query, error: String(error).slice(0, 160) });
    }
  }

  const next = (start + take) % pairs.length;
  try {
    await db
      .prepare(
        `INSERT INTO findings_cursor (id, position, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`,
      )
      .bind(next, now)
      .run();
  } catch {
    /* the cursor is an optimisation; a full grid walk is still correct */
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('findings-refresh', ?, ?, ?, NULL)",
      )
      .bind(now, new Date().toISOString(), results.reduce((n, r) => n + Number("findings" in r ? r.findings : 0), 0))
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json(
    { ok: true, position: next, grid: pairs.length, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
