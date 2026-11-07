import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  bladePct,
  composite as recomputeComposite,
  emptyClock,
  formatCountdown,
  secondsToMidnight,
  type AdaVoice,
  type ClockState,
  type Dimension,
  type RageItem,
} from "@/lib/clock";

export const revalidate = 0;

const CLOCK_PATH = path.join(process.cwd(), "data", "clock.json");

/**
 * GET /api/clock — the current reading.
 *
 * The stored file holds the model inputs (level, composite, dimensions, items).
 * Every derived number is recomputed here from those inputs, so the dial can
 * never disagree with the data it claims to come from.
 */
export async function GET() {
  try {
    const raw = await readFile(CLOCK_PATH, "utf8");
    const parsed = JSON.parse(raw) as {
      level?: number;
      composite?: number;
      dimensions?: Dimension[];
      items?: RageItem[];
      voice?: AdaVoice;
      computedAt?: string | null;
      nextRunAt?: string | null;
      queryCount?: number;
    };

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const dimensions = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];

    const level = typeof parsed.level === "number" ? parsed.level : 50;
    const comp =
      typeof parsed.composite === "number"
        ? parsed.composite
        : dimensions.length
          ? recomputeComposite(dimensions)
          : 0;

    const computedAt = parsed.computedAt ?? null;
    const stale =
      !computedAt || Date.now() - Date.parse(computedAt) > 24 * 60 * 60 * 1000;

    const seconds = secondsToMidnight(level);

    const state: ClockState = {
      level: Math.round(level * 100) / 100,
      composite: Math.round(comp * 100) / 100,
      pressure: Math.round((comp - level) * 100) / 100,
      dimensions,
      secondsToMidnight: seconds,
      tMinus: formatCountdown(seconds),
      bladePct: bladePct(level),
      items,
      voice: parsed.voice ?? emptyClock().voice,
      computedAt,
      nextRunAt: parsed.nextRunAt ?? null,
      queryCount: parsed.queryCount ?? 0,
      stale,
    };

    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(emptyClock(), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
