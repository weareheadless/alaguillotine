/**
 * What the record proves, and how recently.
 *
 * The queue used to be ranked by a model reading of the week's wire, with the
 * ledger as a tie-breaker. That meant a name could hold the top of the line on
 * a record from 1994, or climb twelve points a pass for having been chopped.
 * This module replaces that with one rule: a name's number is the harm its
 * documented acts account for inside a fixed window.
 *
 * The arithmetic is deliberately boring. Each act is weighted by its
 * confidence, its category, and how much of it is the person's own, then the
 * five heaviest are summed. Not all of them: summing every act scores
 * coverage, and coverage is not harm. Five press-strategy entries outweighed
 * one documented massacre, because there were five of them. A sixth act does
 * not make a record worse, it makes it better documented.
 *
 * The sum saturates, so no single record runs away with the top. The window is
 * the clock: an act outside it counts for nothing, and an act whose month we do
 * not know counts for half, because the year alone cannot prove it is inside
 * the window.
 *
 * Nothing here judges a person. It measures what the record says, recently.
 */

export const EVIDENCE_WINDOW_DAYS = 180;

/** A chopped name sits out this long before the blade can take it again. */
export const COOLDOWN_DAYS = 3;

/** The blade is drawn from the worst names by evidence, not from everyone. */
export const SENTENCE_BAND = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How much a documented act of each kind weighs. A death is not a subsidy
 * package, and a press strategy is not a massacre. These are editorial
 * weights, stated here so they can be argued with.
 */
const CATEGORY_WEIGHT: Record<string, number> = {
  genocide: 1,
  war: 0.9,
  repression: 0.8,
  migration: 0.75,
  arms: 0.7,
  climate: 0.6,
  impunity: 0.6,
  labour: 0.5,
  extraction: 0.5,
  finance: 0.4,
  media: 0.4,
};

const DEFAULT_WEIGHT = 0.5;

/** The sum at which the score reaches about 63. A handful of strong acts. */
export const SCORE_SATURATION = 2.5;

/**
 * How much of an act's weight survives to the edge of the window.
 *
 * This is the difference between a ledger and a front page. The record is the
 * record, but a guillotine is a crowd, and a crowd is moved by what is
 * happening now: an atrocity committed this week should move the line in a way
 * the same atrocity at day 179 does not. So a fresh act counts full and fades
 * to 55% by the end of the window — never to nothing inside it, because the
 * window is the promise, not the mood.
 */
export const RECENCY_FLOOR = 0.55;
const SATURATION = SCORE_SATURATION;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export interface LedgerAct {
  act: string;
  place?: string;
  year: number;
  category?: string;
  confidence: number;
  /**
   * How much of the act is this person's own, 0–1. A Yea on a 435-member
   * defence authorisation is a small share of one; a Yea on the motion to table
   * an impeachment is a hand on the thing. Defaults to 1, so every act filed
   * before this existed counts as it did.
   */
  attribution?: number;
}

export interface EvidenceAct extends LedgerAct {
  /** ISO date when the text gives one, otherwise null and only the year is known. */
  date: string | null;
  weight: number;
}

export interface Evidence {
  /** 0–100, rounded to one decimal. */
  score: number;
  /** Weighted count of acts inside the window. */
  acts: number;
  /** The raw weighted sum, for the page to show its work. */
  total: number;
  /** The most recent act inside the window, for the card. */
  newest: EvidenceAct | null;
}

export interface ActDate {
  at: Date;
  /** True when the text names a month, false when only the year is known. */
  precise: boolean;
}

/** The date an act states, as best the text allows. */
export function actDate(act: string, year: number): ActDate | null {
  const text = String(act || "");

  const dayMonthYear = text.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i,
  );
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase().slice(0, 3)];
    const date = utc(Number(dayMonthYear[3]), month, Number(dayMonthYear[1]));
    if (date) return { at: date, precise: true };
  }

  const monthDayYear = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1].toLowerCase().slice(0, 3)];
    const date = utc(Number(monthDayYear[3]), month, Number(monthDayYear[2]));
    if (date) return { at: date, precise: true };
  }

  // "November 2026" — a month and a year, no day. Use the first, so an act
  // dated to a month that has not finished is never placed in the future.
  const monthYear = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i,
  );
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase().slice(0, 3)];
    const date = utc(Number(monthYear[2]), month, 1);
    if (date) return { at: date, precise: true };
  }

  // The year the entry was filed is the only date we have. Mid-year is the
  // least wrong guess, and `evidenceFor` will only half-count it anyway.
  const y = Number(year);
  if (Number.isFinite(y) && y > 1900 && y < 2200) {
    const date = utc(y, 7, 1);
    if (date) return { at: date, precise: false };
  }
  return null;
}

function utc(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, Math.min(Math.max(day, 1), 28)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Score a person's ledger inside the window.
 *
 * Dated acts inside the window count, freshest first: an act fades from full
 * weight on the day it happened to 55% on its last day in the window, because
 * the blade is a crowd and a crowd is moved by now. Undated acts from the
 * current year count half: the year proves they are recent, not that they are
 * inside the window. Older acts do not count at all.
 *
 * Only the five heaviest acts are summed. The count of acts is still reported
 * beside the number, because how much was documented is worth knowing — it just
 * does not buy a higher score.
 */
export function evidenceFor(
  entries: LedgerAct[],
  now: number = Date.now(),
): Evidence {
  const today = new Date(now);
  const currentYear = today.getUTCFullYear();
  const values: number[] = [];
  let acts = 0;
  let newest: EvidenceAct | null = null;
  let newestAt = -Infinity;
  let credible: EvidenceAct | null = null;
  let credibleAt = -Infinity;
  const future = now + 7 * DAY_MS;

  for (const entry of entries) {
    let stamp = actDate(entry.act, entry.year);
    if (!stamp) continue;
    // A date in the future is a model slip, not a fact. Fall back to the year.
    if (stamp.at.getTime() > future) stamp = { ...stamp, precise: false };

    const ageDays = (now - stamp.at.getTime()) / DAY_MS;
    let weight: number;

    if (stamp.precise && ageDays <= EVIDENCE_WINDOW_DAYS && ageDays >= -7) {
      // Fresh acts lead. The fade is linear, so it can be checked by hand:
      // today is 1.0, ninety days is 0.775, the last day of the window is 0.55.
      const fade = Math.min(1, Math.max(0, ageDays / EVIDENCE_WINDOW_DAYS));
      weight = 1 - (1 - RECENCY_FLOOR) * fade;
    } else if (entry.year === currentYear && !stamp.precise) {
      // A bare year cannot put the act inside the window. Half is the honest
      // guess, and it keeps a January act from counting like an October one.
      weight = 0.5;
    } else {
      continue;
    }

    const confidence = Math.min(100, Math.max(0, Number(entry.confidence) || 0)) / 100;
    const category = CATEGORY_WEIGHT[String(entry.category || "").toLowerCase()] ?? DEFAULT_WEIGHT;
    const attribution = Math.min(1, Math.max(0, Number(entry.attribution ?? 1)));
    const value = weight * confidence * category * attribution;
    values.push(value);
    acts += weight;

    const act: EvidenceAct = {
      ...entry,
      date: stamp.precise ? stamp.at.toISOString().slice(0, 10) : null,
      weight,
    };
    const seen = stamp.at.getTime();
    if (!newest || seen > newestAt) {
      newestAt = seen;
      newest = act;
    }
    // The card shows the newest act the record is actually confident about.
    if (confidence >= 0.6 && (!credible || seen > credibleAt)) {
      credibleAt = seen;
      credible = act;
    }
  }

  // The five worst acts, and no more. Sorted descending so a record with one
  // massacre cannot be diluted by four good weeks, and cannot be inflated by
  // fifty press releases either.
  const total = values
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((sum, v) => sum + v, 0);

  const score = total > 0 ? 100 * (1 - Math.exp(-total / SATURATION)) : 0;
  return {
    score: Math.round(score * 10) / 10,
    acts: Math.round(acts * 10) / 10,
    total: Math.round(total * 100) / 100,
    newest: credible ?? newest,
  };
}

/** The sentence band: the worst names by evidence, and only those. */
export function inBand(score: number, bandScore: number): boolean {
  return score > 0 && score >= bandScore;
}
