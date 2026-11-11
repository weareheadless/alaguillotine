import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { refreshFeed } from "@/lib/feed";
import { glossFeed } from "@/lib/feed-gloss";

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
  if (
    !secret ||
    (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const result = await refreshFeed(db);
  const glossed = await glossFeed(db, env, 24);
  return Response.json({ ok: true, ...result, glossed });
}
