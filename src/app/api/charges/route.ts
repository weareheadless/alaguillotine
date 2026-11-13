import { chargeStats, recentCharges } from "@/lib/archive-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/charges — what research just filed.
 *
 * The rails read this: the newest sourced act per name, plus how many charges
 * landed in the last day. Cached for a minute at the edge, because a rail does
 * not need to poll a database per visitor per second.
 */
export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 10);
  const limit = Number.isFinite(raw) ? Math.min(24, Math.max(1, Math.round(raw))) : 10;

  const [charges, stats] = await Promise.all([recentCharges(limit), chargeStats()]);

  return Response.json(
    { ok: true, charges, ...stats },
    {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
