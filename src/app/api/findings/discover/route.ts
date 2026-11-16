import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { discoverPower, POWER_QUERIES, type DiscoveryTally } from "@/lib/discovery";
import { OUTLETS } from "@/lib/findings";
import { rescoreQueue } from "@/lib/hate-store";
import { judgeConfig } from "@/lib/act-judge";

export const dynamic = "force-dynamic";

type Env = {
  CRON_SECRET?: string;
  SITE_AGENT_LLM_API_KEY?: string;
  CLOCK_CHAT_BASE?: string;
  CLOCK_MODEL?: string;
};

/**
 * POST /api/findings/discover — find names the line does not have.
 *
 * One outlet × one power term per run, walking the grid. The sentence supplies
 * the role, the act and the passage; the name is the output.
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
  const explicitOutlet = (params.get("outlet") ?? "").trim();
  const explicitQuery = (params.get("query") ?? "").trim();
  const per = Math.max(1, Math.min(30, Number(params.get("per") ?? 15) || 15));

  const grid = OUTLETS.flatMap((outlet) =>
    POWER_QUERIES.map((query) => ({ outlet: outlet.key, query })),
  );
  const cursor = await db
    .prepare("SELECT position FROM discovery_cursor WHERE id = 1 LIMIT 1")
    .first<{ position: number }>();
  const position = Math.max(0, Number(cursor?.position ?? 0));
  const pair =
    explicitOutlet && explicitQuery
      ? { outlet: explicitOutlet, query: explicitQuery }
      : grid[position % grid.length];

  const judge = judgeConfig(context.env ?? {});
  const results: Array<DiscoveryTally | { outlet: string; query: string; error: string }> = [];
  try {
    results.push(await discoverPower(db, pair.outlet, pair.query, per, judge));
  } catch (error) {
    results.push({ outlet: pair.outlet, query: pair.query, error: String(error).slice(0, 180) });
  }

  const next = explicitOutlet && explicitQuery ? position : (position + 1) % grid.length;
  try {
    await db
      .prepare(
        `INSERT INTO discovery_cursor (id, position, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`,
      )
      .bind(next, new Date().toISOString())
      .run();
  } catch {
    /* the cursor only orders the grid; a failed write repeats one pair */
  }

  const found = results.reduce(
    (n, r) => n + ("acts" in r ? r.acts : 0),
    0,
  );

  // The new name has a receipt and now needs its number: score it before the
  // response, so the page and the line order agree with the archive at once.
  let rescored = 0;
  try {
    rescored = await rescoreQueue(db);
  } catch {
    /* the four-hourly pass will still put the numbers right */
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('discovery', ?, ?, ?, NULL)",
      )
      .bind(new Date().toISOString(), new Date().toISOString(), found)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json(
    { ok: true, ...pair, position: next, grid: grid.length, rescored, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
