import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import { writeTakesFor } from "@/lib/claim-take";
import { publishClaimsToFeed } from "@/lib/claim-feed";

export const dynamic = "force-dynamic";

/**
 * POST /api/claims/takes — Ada's take, beside the claim.
 *
 * Cron-only, small batches, one model call per five claims. The take is
 * validated before it is stored: it must reason (a conditional, a consequence),
 * and it must not be the claim in other words. A claim whose take fails that
 * test travels without one rather than with a restatement.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_CHAT_BASE?: string;
      CLOCK_MODEL?: string;
      D1?: unknown;
    };
  };

  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = context.env?.D1 as Parameters<typeof writeTakesFor>[0] | undefined;
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const limit = Math.min(60, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 10)));
  const report = await writeTakesFor(db, context.env ?? {}, limit);

  let published = 0;
  try {
    published = (await publishClaimsToFeed(db, { days: 7, limit: 40 })).published;
  } catch {
    /* the feed is downstream of the record */
  }

  return Response.json({ ok: true, ...report, published }, {
    headers: { "Cache-Control": "no-store" },
  });
}
