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
  const rewrite = Number(params.get("rewrite") ?? 0);
  if (rewrite > 0) {
    const glossed = await glossFeed(db, env, Math.min(20, rewrite), { rewrite: true });
    return Response.json(
      { ok: true, rewrite: true, glossed },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await refreshFeed(db);
  const glossed = await glossFeed(db, env, 12);
  return Response.json({ ok: true, ...result, glossed });
}
