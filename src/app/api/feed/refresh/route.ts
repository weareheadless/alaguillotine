import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { refreshFeed } from "@/lib/feed";
import { glossFeed } from "@/lib/feed-gloss";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type FeedEnv = {
  CRON_SECRET?: string;
  SITE_AGENT_LLM_API_KEY?: string;
  CLOCK_CHAT_BASE?: string;
  CLOCK_MODEL?: string;
};

/**
 * POST /api/feed/refresh — the feed's fifteen-minute pass.
 *
 * Pull the federated wire, file the record, cluster the repeats, expire what
 * is old, and let Ada put a charge on whatever is new. Never exposed to the
 * browser; the cron secret is the only key.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as {
    env?: FeedEnv;
  };
  const env = context.env ?? {};
  const secret = env.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const params = new URL(request.url).searchParams;
  // ?rewrite=12 re-writes takes that already exist, for a voice pass, without
  // pulling the wire or touching anything else.
  // ?gloss=40 is the catch-up path: take the newest unwritten wire items and
  // write their takes without pulling the wire again. The cron does the same
  // work in smaller batches after each pull.
  const catchUp = Number(params.get("gloss") ?? 0);
  if (catchUp > 0) {
    const glossed = await glossFeed(db, env, Math.min(60, catchUp));
    return Response.json(
      { ok: true, catchUp: true, glossed },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const rewrite = Number(params.get("rewrite") ?? 0);
  if (rewrite > 0) {
    const glossed = await glossFeed(db, env, Math.min(20, rewrite), { rewrite: true });
    return Response.json(
      { ok: true, rewrite: true, glossed },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Every pass leaves a row. A cron that dies leaves a gap, which is how a
  // missing cycle becomes visible instead of looking like a quiet afternoon.
  const started = new Date().toISOString();
  let runId = 0;
  try {
    const res = (await db
      .prepare("INSERT INTO feed_runs (source, started_at) VALUES (?, ?)")
      .bind(cron ? "cron" : "manual", started)
      .run()) as { meta?: { last_row_id?: number } };
    runId = Number(res.meta?.last_row_id ?? 0);
  } catch {
    /* logging must never block the feed */
  }

  let result = { fetched: 0, added: 0, records: 0, clustered: 0, glossed: 0, pruned: 0 };
  let glossed = 0;
  try {
    result = await refreshFeed(db);
    glossed = await glossFeed(db, env, 30);
  } catch (error) {
    if (runId) {
      try {
        await db
          .prepare("UPDATE feed_runs SET finished_at = ?, error = ? WHERE id = ?")
          .bind(new Date().toISOString(), String(error).slice(0, 300), runId)
          .run();
      } catch {
        /* the log is best effort */
      }
    }
    throw error;
  }
  if (runId) {
    try {
      await db
        .prepare("UPDATE feed_runs SET finished_at = ?, added = ?, glossed = ? WHERE id = ?")
        .bind(new Date().toISOString(), result.added, glossed, runId)
        .run();
    } catch {
      /* best effort */
    }
  }
  return Response.json({ ok: true, ...result, glossed });
}
