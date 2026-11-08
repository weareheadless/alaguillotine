/**
 * Hateometer — the second instrument.
 *
 * Same machinery as the clock, different subject: reported war, repression and
 * the trade that feeds both. It is not a verdict on anyone. It measures how much
 * documented harm is being reported in whose name this week, and it shows the
 * movement, because a leaderboard that never moves is a poster.
 *
 * The model mirrors src/lib/clock.ts: shrunk dimension means, weighted
 * composite, EWMA level with a per-reading cap.
 */

import { nextLevel, shrink } from "./clock";

export type HateKey = "war" | "civilian" | "repression" | "arms" | "incitement";

export interface HateSpec {
  key: HateKey;
  label: string;
  weight: number;
}

export const HATE_DIMENSIONS: HateSpec[] = [
  { key: "war", label: "war", weight: 0.25 },
  { key: "civilian", label: "civilian harm", weight: 0.25 },
  { key: "repression", label: "repression", weight: 0.2 },
  { key: "arms", label: "arms trade", weight: 0.15 },
  { key: "incitement", label: "incitement", weight: 0.15 },
];

export interface HateDimension {
  key: HateKey;
  label: string;
  weight: number;
  score: number;
  evidence: number;
}

export interface Figure {
  name: string;
  role: string;
  country: string;
  /** 0–100. Shrunk mean of the harm score of the reports naming them. */
  score: number;
  /** Distinct reports naming them this pass. */
  mentions: number;
  reason: string;
  source: string;
  sourceUrl: string;
  /** The reports that put them here, newest first. */
  items: Array<{
    headline: string;
    fact: string;
    quip: string;
    source: string;
    sourceUrl: string;
    publishedAt: string | null;
    harm: number;
  }>;
  rank: number;
  prevRank: number | null;
  delta: number | null;
  /** When Ada first put them in the queue. */
  addedAt?: string;
  /** When the blade fell. Null while they are still standing. */
  droppedAt?: string | null;
  /** How many ledger entries are on record for this name. */
  ledgerCount?: number;
  /** How many times the blade has fallen on this name. */
  timesChopped?: number;
  /** Points added to the score by the ledger on record. */
  recordBonus?: number;
  /** The highest-confidence charges on record, for the block brief. */
  topCharges?: Array<{
    act: string;
    place: string;
    year: number;
    category: string;
    confidence: number;
  }>;
  /** When the blade last fell on this name. */
  lastChoppedAt?: string | null;
}

export interface HateState {
  level: number;
  composite: number;
  pressure: number;
  dimensions: HateDimension[];
  figures: Figure[];
  chops: Array<{ person: string; slug: string; count: number; lastAt: string }>;
  computedAt: string | null;
  nextRunAt: string | null;
  stale: boolean;
  /** The name under the blade, and how long until it falls. */
  execution?: {
    person: string;
    slug: string;
    score: number;
    sentencedAt: string;
    executeAt: string;
    secondsLeft: number;
  } | null;
  /** The blade that just fell, shown while the wound is fresh. */
  lastExecution?: {
    person: string;
    slug: string;
    score: number;
    executedAt: string;
  } | null;
}

export const HATE_REFRESH_MS = 12 * 60 * 60 * 1000;

/** The blade falls at this counter. The chop is a tally; the counter resets and the name climbs back. */
export const DROP_THRESHOLD = 90;

export function emptyHate(): HateState {
  return {
    level: 15,
    composite: 0,
    pressure: 0,
    dimensions: HATE_DIMENSIONS.map((d) => ({
      key: d.key,
      label: d.label,
      weight: d.weight,
      score: 50,
      evidence: 0,
    })),
    figures: [],
    chops: [],
    computedAt: null,
    nextRunAt: null,
    stale: true,
    execution: null,
    lastExecution: null,
  };
}

/** Rank figures by score, then by mentions, and attach movement vs the last pass. */
export function rankFigures(
  next: Omit<Figure, "rank" | "prevRank" | "delta">[],
  previous: Figure[],
): Figure[] {
  const prevRank = new Map(previous.map((f) => [f.name.toLowerCase(), f.rank]));
  return next
    .slice()
    .sort((a, b) => b.score - a.score || b.mentions - a.mentions)
    .map((f, i) => {
      const rank = i + 1;
      const was = prevRank.get(f.name.toLowerCase()) ?? null;
      return {
        ...f,
        rank,
        prevRank: was,
        delta: was === null ? null : was - rank,
      };
    });
}

export { nextLevel, shrink };
