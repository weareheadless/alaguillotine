import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishClaimsToFeed } from "@/lib/claim-feed";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/claim-feed/publish — the record to the front page.
 *
 * Cron-only and idempotent. The twelve-hour research pass already calls this
 * after it writes; this door exists so the step can be run on its own without
 * paying for a model pass, and so a failed publish can be retried.
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
  const cron = Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = context.env?.D1;
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") ?? 7)));
  const report = await publishClaimsToFeed(db, { days, limit: 60 });
  return Response.json({ ok: true, ...report }, { headers: { "Cache-Control": "no-store" } });
}
