import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import { dateClaims } from "@/lib/claim-dating";
import { publishClaimsToFeed } from "@/lib/claim-feed";

export const dynamic = "force-dynamic";

/**
 * POST /api/claims/date — read the date out of the claim.
 *
 * The feed will not carry a claim it cannot place inside a day, and most claims
 * were filed with a year even when the sentence says "On 10 November 2026".
 * This pass reads that date, writes it, and re-runs the feed bridge so a claim
 * that is genuinely recent can become a card. A month or a year on its own is
 * left undated.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { CRON_SECRET?: string; D1?: unknown };
  };

  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = context.env?.D1 as Parameters<typeof dateClaims>[0] | undefined;
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const limit = Math.min(500, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 200)));
  const report = await dateClaims(db, limit);

  let published = 0;
  try {
    published = (await publishClaimsToFeed(db, { days: 2, limit: 40 })).published;
  } catch {
    /* the feed is downstream of the record */
  }

  return Response.json(
    { ok: true, ...report, published },
    { headers: { "Cache-Control": "no-store" } },
  );
}
