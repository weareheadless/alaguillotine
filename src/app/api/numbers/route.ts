import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import { clockConfig } from "@/lib/clock-research";
import {
  numbersSummary,
  registerNumberNames,
  runNumbersBatch,
  type NumbersDb,
} from "@/lib/numbers";

export const dynamic = "force-dynamic";

/**
 * /api/numbers — the figures behind each name.
 *
 * GET returns the count and, with ?rows=1, the per-name status. POST (cron
 * secret or admin key) registers any new queue names and runs the next
 * numbers batch. One name at a time: six searches and one extraction is
 * slower than the ledger passes, and a timeout should cost one name.
 */

interface Env {
  CRON_SECRET?: string;
  DEEPSEEK_API_KEY?: string;
  SITE_AGENT_LLM_API_KEY?: string;
  CLOCK_SEARCH_BASE?: string;
  CLOCK_CHAT_BASE?: string;
  CLOCK_MODEL?: string;
  CHAT_UPSTREAM?: string;
  ADA_KEY?: string;
  D1?: NumbersDb;
}

export async function GET(request: Request) {
  const ctx = (await getCloudflareContext({ async: true })) as unknown as { env?: Env };
  const db = ctx.env?.D1;
  if (!db) return Response.json({ error: "no db" }, { status: 500 });
  const rows = new URL(request.url).searchParams.get("rows") === "1";
  const summary = await numbersSummary(db, rows);
  const safe = rows
    ? {
        ...summary,
        rows: summary.rows.map((r) => ({
          name: r.name,
          status: r.status,
          found: r.found,
          checkedAt: r.checkedAt,
        })),
      }
    : summary;
  return Response.json(
    { ok: true, ...safe },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const ctx = (await getCloudflareContext({ async: true })) as unknown as { env?: Env };
  const secret = ctx.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = ctx.env?.D1;
  if (!db) return Response.json({ error: "no db" }, { status: 500 });

  const config = clockConfig(ctx.env ?? {});
  if (!config) return Response.json({ error: "no model key" }, { status: 500 });

  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    const summary = await numbersSummary(db, url.searchParams.get("rows") === "1");
    return Response.json({ ok: true, ...summary });
  }

  const batch = Math.min(3, Math.max(1, Number(url.searchParams.get("batch") ?? 1)));
  const added = await registerNumberNames(db);
  const run = await runNumbersBatch(db, config, batch);
  const summary = await numbersSummary(db, false);
  return Response.json({ ok: true, added, run, ...summary });
}
