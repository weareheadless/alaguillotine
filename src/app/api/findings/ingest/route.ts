import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ingestFindings } from "@/lib/findings-ingest";
import { OUTLETS } from "@/lib/findings";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/findings/ingest?outlet=propublica&query=convicted&per=20
 *
 * One investigative archive search. The query is a finding word
 * ("convicted", "bribery", ...), not a name: the wrongdoing finds the person.
 * The cron runs the same pass through /api/findings/refresh.
 */

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

  const params = new URL(request.url).searchParams;
  const outletKey = (params.get("outlet") ?? "propublica").trim();
  const query = (params.get("query") ?? "convicted").trim();
  const per = Math.max(1, Math.min(50, Number(params.get("per") ?? 20) || 20));
  const after = (params.get("after") ?? "2020-01-01T00:00:00").trim();

  if (!OUTLETS.some((entry) => entry.key === outletKey)) {
    return Response.json(
      { error: `unknown outlet ${outletKey}`, outlets: OUTLETS.map((o) => o.key) },
      { status: 400 },
    );
  }

  const started = new Date().toISOString();
  try {
    const tally = await ingestFindings(db, outletKey, query, per, after);
    try {
      await db
        .prepare(
          "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('findings', ?, ?, ?, ?)",
        )
        .bind(started, new Date().toISOString(), tally.findings, tally.errors[0] ?? null)
        .run();
    } catch {
      /* logging never blocks the pass */
    }
    return Response.json({ ok: true, ...tally }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: `archive unavailable: ${String(error)}` }, { status: 502 });
  }
}
