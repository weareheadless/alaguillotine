import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { backfillWire } from "@/lib/feed";
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
 * POST /api/feed/backfill?days=14&pages=3 — fill the archive window.
 *
 * The feed keeps thirty days of wire but was only ever collecting one, so the
 * archive began empty the day the rule changed. This walks back through the
 * communities' older pages, files what falls inside the window, and then writes
 * takes for it in bounded batches. A backfilled item is published only once it
 * has a take, and it keeps its own date: nothing is re-dated to look current.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as { env?: FeedEnv };
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
  const days = Math.max(1, Math.min(30, Number(params.get("days") ?? 14) || 14));
  const pages = Math.max(1, Math.min(8, Number(params.get("pages") ?? 3) || 3));
  const budget = Math.max(0, Math.min(40, Number(params.get("batches") ?? 12) || 12));

  const result = await backfillWire(db, days, pages);

  // Takes, in bounded batches, until the money or the queue runs out. Each
  // successful batch writes real takes; validation failures are marked and do
  // not come back, so the loop always makes progress until it cannot.
  let glossed = 0;
  let batches = 0;
  for (let i = 0; i < budget; i += 1) {
    const filed = await glossFeed(db, env, 12, { windowDays: days });
    batches += 1;
    glossed += filed;
    if (filed === 0) break;
  }

  return Response.json(
    { ok: true, days, pages, ...result, glossed, batches },
    { headers: { "Cache-Control": "no-store" } },
  );
}
