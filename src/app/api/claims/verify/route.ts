import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import { runCitationCheck } from "@/lib/claim-verify";
import { publishClaimsToFeed } from "@/lib/claim-feed";

export const dynamic = "force-dynamic";

/**
 * POST /api/claims/verify — read the citation, not the claim.
 *
 * The batch is small on purpose: every claim costs one or two page fetches, and
 * a source that is down today may be up tomorrow. Anything verified is accepted
 * and published in the same call; anything that could not be read stays
 * pending with the reason written next to it.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      D1?: {
        prepare: (q: string) => {
          bind: (...v: unknown[]) => {
            run: () => Promise<unknown>;
            all: () => Promise<{ results?: Array<Record<string, unknown>> }>;
          };
        };
      };
    };
  };

  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = context.env?.D1;
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const url = new URL(request.url);
  const limit = Math.min(80, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const report = await runCitationCheck(db, { limit });

  let published = 0;
  try {
    published = (await publishClaimsToFeed(db, { days: 3, limit: 40 })).published;
  } catch {
    /* the feed is downstream of the record */
  }

  return Response.json({ ok: true, ...report, published }, {
    headers: { "Cache-Control": "no-store" },
  });
}
