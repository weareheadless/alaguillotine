import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig, runClockPass } from "@/lib/clock-research";
import { getDb, readClock, writeClock } from "@/lib/clock-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/clock/refresh — Ada's research pass.
 *
 * Called by the Worker's scheduled handler with the cron secret. Never exposed
 * to the browser. If the model fails, the previous reading stands: the clock
 * never falls back to zero because a request timed out.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      DEEPSEEK_API_KEY?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_API_BASE?: string;
      CLOCK_MODEL?: string;
    };
  };

  const secret = context.env?.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = clockConfig(context.env ?? {});
  if (!config) {
    return Response.json({ error: "no model key configured" }, { status: 500 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  try {
    const previous = await readClock(db);
    const pass = await runClockPass(config, previous?.level ?? null);

    // Same results as last time: keep the scores, only advance the timestamp.
    if (previous && previous.sourceHash === pass.sourceHash) {
      await writeClock(db, { ...previous, computedAt: pass.computedAt });
      return Response.json({ ok: true, unchanged: true, level: previous.level });
    }

    await writeClock(db, pass);
    return Response.json({ ok: true, level: pass.level, composite: pass.composite });
  } catch (error) {
    console.error("clock_refresh_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "refresh failed" }, { status: 502 });
  }
}
