import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig, runClockPass, type ClockPass } from "@/lib/clock-research";
import { fetchAdaVoice } from "@/lib/ada-voice";
import { keepDailyPromise } from "@/lib/clock";
import { getDb, readClock, rememberAds, writeClock } from "@/lib/clock-store";
import { refreshReel } from "@/lib/reel-refresh";
import { archiveItems } from "@/lib/archive-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/clock/refresh — Ada's research pass.
 *
 * Called by the Worker's scheduled handler with the cron secret. Never exposed
 * to the browser. If the model fails, the previous reading stands: the clock
 * never falls back to zero because a request timed out.
 */
/**
 * Ask Ada on the VPS to write the editorial voice for this reading: mood,
 * banner, popups, subliminals, the promise and item quips. The Worker keeps the
 * research and the numbers; she keeps the voice. If she is unreachable, the
 * Worker's own fallback voice stays in place.
 */
async function applyAdaVoice(
  env: { CHAT_UPSTREAM?: string; ADA_KEY?: string },
  pass: ClockPass,
): Promise<void> {
  const fallbackPromise = pass.voice.promise;
  const result = await fetchAdaVoice(env, pass.level, pass.composite, pass.items);
  if (!result) return;

  pass.voice = result.voice;
  // The /voice service may be older than the promise field. Keep the one the
  // reading already wrote rather than losing the card to a fallback.
  if (!pass.voice.promise && fallbackPromise) {
    pass.voice.promise = fallbackPromise;
    pass.voice.promiseAt = new Date().toISOString();
  }
  pass.items.forEach((item, i) => {
    const quip = result.quips[i];
    if (quip?.trim()) item.quip = quip.trim().slice(0, 160);
  });
}

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      YOUTUBE_API_KEY?: string;
      DEEPSEEK_API_KEY?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_API_BASE?: string;
      CLOCK_MODEL?: string;
      CHAT_UPSTREAM?: string;
      ADA_KEY?: string;
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
    await applyAdaVoice(context.env ?? {}, pass);

    // She rewrites the front page when she has something to say. On the
    // readings where she does not, the last headline she wrote stands.
    if (pass.voice) {
      // A promise of the day does not change six times before lunch.
      pass.voice = keepDailyPromise(pass.voice, previous?.voice);
      if (!pass.voice.headline && previous?.voice.headline) {
        pass.voice.headline = previous.voice.headline;
      }
      if (!pass.voice.subheadline && previous?.voice.subheadline) {
        pass.voice.subheadline = previous.voice.subheadline;
      }
    }

    // The popups accumulate across readings, so the stack has a week of them
    // to draw from instead of the four she wrote this time.
    try {
      await rememberAds(db, pass.voice?.ads ?? []);
    } catch {
      /* the pool table may not exist yet */
    }

    // Same results as last time: keep the scores, but refresh Ada's voice so
    // the mood and the jokes still move with her.
    if (previous && previous.sourceHash === pass.sourceHash) {
      // Keep the old scores, but carry Ada's fresh quips across too.
      previous.items.forEach((item, i) => {
        const fresh = pass.items[i];
        if (fresh?.quip) item.quip = fresh.quip;
      });
      await writeClock(db, { ...previous, voice: pass.voice, computedAt: pass.computedAt });
      const clips = await refreshReel(context.env?.YOUTUBE_API_KEY);
      return Response.json({ ok: true, unchanged: true, level: previous.level, clips });
    }

    await writeClock(db, pass);
    await archiveItems(pass.items);

    // The reel: whatever video the same search turned up, if any of it plays.
    const clips = await refreshReel(context.env?.YOUTUBE_API_KEY);

    return Response.json({ ok: true, level: pass.level, composite: pass.composite, clips });
  } catch (error) {
    console.error("clock_refresh_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "refresh failed" }, { status: 502 });
  }
}
