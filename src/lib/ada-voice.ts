import type { AdaVoice, RageItem } from "./clock";
import { normaliseVoice } from "./clock-research";

/**
 * Ask Ada's own voice service for the site voice.
 *
 * Shared by the four-hour reading and the desk's voice-only refresh, so both
 * paths send the same payload and normalise the answer the same way.
 */

export interface VoiceEnv {
  CHAT_UPSTREAM?: string;
  ADA_KEY?: string;
}

export interface VoiceResult {
  voice: AdaVoice;
  quips: string[];
}

export async function fetchAdaVoice(
  env: VoiceEnv,
  level: number,
  composite: number,
  items: RageItem[],
): Promise<VoiceResult | null> {
  const base = env.CHAT_UPSTREAM || "https://api.helloada.app/ada";
  const key = env.ADA_KEY || "";
  if (!key) return null;

  try {
    const res = await fetch(`${base}/voice`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Ada-Key": key,
      },
      body: JSON.stringify({
        level,
        composite,
        items: items.slice(0, 10).map((item) => ({
          headline: item.headline,
          fact: item.fact,
          source: item.source,
          dimension: item.dimension,
        })),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      mood?: string;
      line?: string;
      banner?: unknown;
      ads?: unknown;
      subliminal?: unknown;
      promise?: unknown;
      quips?: unknown;
    };
    if (!data?.mood || !data?.line) return null;
    return {
      voice: normaliseVoice(data),
      quips: (Array.isArray(data.quips) ? data.quips : []).filter(
        (q): q is string => typeof q === "string" && Boolean(q.trim()),
      ),
    };
  } catch {
    return null;
  }
}
