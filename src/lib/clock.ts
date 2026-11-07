/**
 * Doomsday Clock — shared model.
 *
 * The full derivation is in docs/CLOCK_MODEL.md. Short version: five weighted
 * dimensions, each shrunk toward a neutral prior, blended into a composite; the
 * level is an EWMA of the composite with a hard cap on movement per reading; the
 * clock and the blade are two renderings of the level.
 *
 * The model only scores items. The arithmetic is here, in the open, so anyone
 * can recompute the blade from the stored reading and check it.
 */

export type DimensionKey =
  | "extraction"
  | "cost"
  | "impunity"
  | "suppression"
  | "precarity";

export interface DimensionSpec {
  key: DimensionKey;
  label: string;
  weight: number;
}

export const DIMENSIONS: DimensionSpec[] = [
  { key: "extraction", label: "extraction", weight: 0.25 },
  { key: "cost", label: "cost of living", weight: 0.2 },
  { key: "impunity", label: "impunity", weight: 0.2 },
  { key: "suppression", label: "suppression", weight: 0.2 },
  { key: "precarity", label: "precarity", weight: 0.15 },
];

/** Shrinkage prior: a dimension needs ~3 items before it reads at face value. */
export const SHRINK_M = 3;
/** Fraction of the gap to the composite that one reading closes. */
export const ALPHA = 0.12;
/** Hard cap on movement per reading, in points. */
export const MAX_STEP = 6;
/** The blade never leaves the frame and never reaches the neck. */
export const LEVEL_FLOOR = 15;
export const LEVEL_CEIL = 99.5;

export interface Dimension {
  key: DimensionKey;
  label: string;
  weight: number;
  score: number;
  evidence: number;
}

export interface RageItem {
  id: string;
  headline: string;
  fact: string;
  quip: string;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  /** 0–100, scored by the model. */
  rage: number;
  topic: string;
  /** Which dimension this item was filed under. */
  dimension?: DimensionKey;
}

export interface AdaVoice {
  /** calm | uneasy | angry | furious | numb */
  mood: string;
  /** One line on the dial, in her voice. */
  line: string;
  /** Top-bar strings she wrote for this reading. */
  banner: string[];
  /** Popups she wrote for this reading. */
  ads: { title: string; body: string; cta: string }[];
  updatedAt: string | null;
}

export interface ClockState {
  /** Where the blade sits. 0–100. */
  level: number;
  /** Raw composite for this reading. */
  composite: number;
  /** composite − level. Positive means the next reading pulls the blade down. */
  pressure: number;
  dimensions: Dimension[];
  secondsToMidnight: number;
  tMinus: string;
  bladePct: number;
  items: RageItem[];
  /** Ada's read of the same data. She is the clock; this is what she says. */
  voice: AdaVoice;
  computedAt: string | null;
  nextRunAt: string | null;
  queryCount: number;
  stale: boolean;
}

// ─── The model ───────────────────────────────────────────────────────────────

/** Shrink a dimension mean toward 50 based on how much evidence supports it. */
export function shrink(mean: number, evidence: number): number {
  if (evidence <= 0) return 50;
  return (evidence * mean + SHRINK_M * 50) / (evidence + SHRINK_M);
}

/** Weighted sum of the dimension scores. */
export function composite(dims: Dimension[]): number {
  let total = 0;
  for (const spec of DIMENSIONS) {
    const d = dims.find((x) => x.key === spec.key);
    if (d) total += spec.weight * d.score;
  }
  return Math.round(total * 100) / 100;
}

/** One EWMA step, with the per-reading clamp and the floor/ceiling. */
export function nextLevel(previous: number | null, c: number): number {
  if (previous === null || !Number.isFinite(previous)) {
    return clampLevel(c);
  }
  const raw = previous + ALPHA * (c - previous);
  const stepped = Math.max(previous - MAX_STEP, Math.min(previous + MAX_STEP, raw));
  return clampLevel(stepped);
}

function clampLevel(v: number): number {
  return Math.round(Math.max(LEVEL_FLOOR, Math.min(LEVEL_CEIL, v)) * 100) / 100;
}

/** Level → seconds to midnight. Squared so the clock slows near the end. */
export function secondsToMidnight(level: number): number {
  const l = Math.max(0, Math.min(100, level));
  return Math.round(5 + 43195 * Math.pow(1 - l / 100, 2));
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function bladePct(level: number): number {
  return Math.min(97, Math.max(3, Math.round(level * 10) / 10));
}

export function direction(pressure: number): "falling" | "holding" | "recovering" {
  if (pressure > 1) return "falling";
  if (pressure < -1) return "recovering";
  return "holding";
}

export const CLOCK_REFRESH_MS = 4 * 60 * 60 * 1000;

export function emptyClock(): ClockState {
  return {
    level: LEVEL_FLOOR,
    composite: 0,
    pressure: 0,
    dimensions: DIMENSIONS.map((d) => ({
      key: d.key,
      label: d.label,
      weight: d.weight,
      score: 50,
      evidence: 0,
    })),
    secondsToMidnight: secondsToMidnight(LEVEL_FLOOR),
    tMinus: formatCountdown(secondsToMidnight(LEVEL_FLOOR)),
    bladePct: bladePct(LEVEL_FLOOR),
    items: [],
    voice: { mood: "numb", line: "", banner: [], ads: [], updatedAt: null },
    computedAt: null,
    nextRunAt: null,
    queryCount: 0,
    stale: true,
  };
}
