import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  emptyHate,
  type Figure,
  type HateDimension,
  type HateState,
} from "@/lib/hateometer";

export const revalidate = 0;

const HATE_PATH = path.join(process.cwd(), "data", "hateometer.json");

/**
 * GET /api/hateometer — the current reading and the queue.
 *
 * Ranks and movement are computed at write time (scripts/hateometer.cjs) and
 * stored, so the arrows on the page always agree with the data that produced
 * them. This route only derives the readouts.
 */
export async function GET() {
  try {
    const raw = await readFile(HATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as {
      level?: number;
      composite?: number;
      dimensions?: HateDimension[];
      figures?: Figure[];
      computedAt?: string | null;
      nextRunAt?: string | null;
    };

    const level = typeof parsed.level === "number" ? parsed.level : 50;
    const composite = typeof parsed.composite === "number" ? parsed.composite : 0;
    const computedAt = parsed.computedAt ?? null;
    const stale = !computedAt || Date.now() - Date.parse(computedAt) > 36 * 60 * 60 * 1000;

    const state: HateState = {
      level: Math.round(level * 100) / 100,
      composite: Math.round(composite * 100) / 100,
      pressure: Math.round((composite - level) * 100) / 100,
      dimensions:
        Array.isArray(parsed.dimensions) && parsed.dimensions.length
          ? parsed.dimensions
          : emptyHate().dimensions,
      figures: Array.isArray(parsed.figures) ? parsed.figures : [],
      computedAt,
      nextRunAt: parsed.nextRunAt ?? null,
      stale,
    };

    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(emptyHate(), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
