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
import type { PersonNumber } from "./numbers";

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
  /** The year the discovery's act happened, when it came from the wire. */
  actYear?: number;
  name: string;
  role: string;
  country: string;
  /**
   * 0–100. The harm the ledger documents inside the evidence window,
   * weighted by confidence and category. Not the model's reading of the week.
   */
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
    /** The dimension the item was filed under, so a charge can inherit it. */
    dimension?: string;
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
  /** The queue's own slug: the one page a name has, whatever URL found it. */
  slug?: string;
  /** The entity the claims are filed under, for the archive filter. */
  entityId?: string;
  /** Acts inside the evidence window, weighted. */
  windowActs?: number;
  /** The newest credible act inside the window, for the card. */
  latestAct?: {
    act: string;
    place: string;
    year: number;
    category: string;
    confidence: number;
    date: string | null;
  } | null;
  /** Kept for older rows; the queue no longer adds a record bonus. */
  recordBonus?: number;
  /** The highest-confidence charges on record, for the block brief. */
  topCharges?: Array<{
    act: string;
    place: string;
    year: number;
    category: string;
    confidence: number;
  }>;
  /** Has Ada run the full first-look dossier for this name? */
  investigated?: boolean;
  /** The first-look outcome, when one exists. */
  investigation?: {
    status: "pending" | "running" | "done" | "failed";
    checkedAt: string | null;
    /** Charges written to the ledger by the first look. */
    entries: number;
  };
  /** When the blade last fell on this name. */
  lastChoppedAt?: string | null;
  /** The sourced numbers behind the name, when the numbers pass has run. */
  numbers?: PersonNumber[];
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
  /** The whole ledger, not the queue's share: charges on record. */
  ledgerTotal?: number;
  /** Charges whose act is dated inside the last twenty-four hours. */
  ledgerToday?: number;
  /** What the feed is holding right now: items and the newest timestamp. */
  wire?: {
    count: number;
    newestAt: string | null;
  };
  /** The name under the blade, and how long until it falls. */
  execution?: {
    person: string;
    slug: string;
    score: number;
    sentencedAt: string;
    executeAt: string;
    secondsLeft: number;
    /** The charge as it was written when the sentence was made. */
    reason?: string;
    /** JSON: the score and the acts behind it at that moment. */
    basis?: string;
  } | null;
  /** The blade that just fell, shown while the wound is fresh. */
  lastExecution?: {
    person: string;
    slug: string;
    score: number;
    executedAt: string;
    /** The charge the blade fell on, as it was recorded then. */
    reason?: string;
    /** JSON: the score and the acts behind it at that moment. */
    basis?: string;
  } | null;
}

/**
 * Does this wire item actually name the person?
 *
 * The model is told every figure must cite an item, and a standing-record name
 * with no story today will happily cite the nearest war. That is how a Tigray
 * charge ended up under a card showing Ukraine and Myanmar. Attach an item only
 * when the text carries the name or a distinctive part of it.
 */
export function itemMentions(name: string, item: { headline: string; fact: string }): boolean {
  const hay = `${item.headline} ${item.fact}`.toLowerCase();
  const parts = name
    .toLowerCase()
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9'-]/g, ""))
    .filter((p) => p.length >= 4);
  return parts.some((part) => hay.includes(part));
}

export const HATE_REFRESH_MS = 12 * 60 * 60 * 1000;

/**
 * The blade is drawn from the worst names by evidence, not from an absolute
 * score. The top of the line is the appointment; a number is a record, not a
 * verdict, and an arbitrary 90 would either empty the block or fill it with
 * whatever the scale happened to produce.
 */
export { SENTENCE_BAND, COOLDOWN_DAYS } from "./evidence";

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
    ledgerTotal: 0,
    ledgerToday: 0,
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
