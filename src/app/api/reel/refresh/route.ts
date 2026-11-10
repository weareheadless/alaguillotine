import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import { refreshReel } from "@/lib/reel-refresh";

export const dynamic = "force-dynamic";

/**
 * POST /api/reel/refresh — force one YouTube pass from the review desk.
 *
 * The clock cron already does this every four hours. This is for the desk:
 * seed a new query set, or check whether the pool is actually growing, without
 * waiting for the next reading or running the whole clock pass.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      YOUTUBE_API_KEY?: string;
      D1?: {
        prepare: (q: string) => {
          bind: (...v: unknown[]) => {
            first: <T = Record<string, unknown>>() => Promise<T | null>;
          };
        };
      };
    };
  };

  if (!ctx.env?.YOUTUBE_API_KEY) {
    return Response.json({ error: "no youtube key" }, { status: 503 });
  }

  const found = await refreshReel(ctx.env.YOUTUBE_API_KEY);

  let total = 0;
  try {
    const row = await ctx.env?.D1?.prepare("SELECT COUNT(*) AS n FROM reel_clips")
      .bind()
      .first<{ n: number }>();
    total = Number(row?.n ?? 0);
  } catch {
    /* count is cosmetic */
  }

  return Response.json(
    { ok: true, found, total },
    { headers: { "Cache-Control": "no-store" } },
  );
}
