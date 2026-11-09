/**
 * The ritual's timetable.
 *
 * Ada reads the record twice a day, at 00:30 and 12:30 UTC. The blade falls
 * half an hour later, at 01:00 and 13:00 UTC, so there is a fixed appointment
 * and a sentence that hangs long enough for people to gather. Nothing here is
 * a promise: the reading can slip, and nobody may be past ninety when it lands.
 */

export const SENTENCE_LEAD_MS = 30 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The next 00:30 or 12:30 UTC, strictly after `now`. */
export function nextReadingAt(now: number = Date.now()): number {
  const date = new Date(now);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const candidates = [midnight + 30 * 60_000, midnight + 12.5 * 3_600_000];
  return candidates.find((t) => t > now) ?? midnight + DAY_MS + 30 * 60_000;
}

/**
 * The slot a sentence created at `now` would run to, or null if we are not in
 * a sentencing window. Both gates matter: the slot must be within the lead
 * time, and the latest reading must already belong to that slot, so a stale
 * queue at the top of the window cannot sentence someone the new reading is
 * about to replace.
 */
export function sentenceSlot(
  now: number,
  readingAt: string | null | undefined,
): number | null {
  const slot = nextExecutionSlot(now);
  if (slot - now > SENTENCE_LEAD_MS) return null;
  const at = readingAt ? Date.parse(readingAt) : NaN;
  if (!Number.isFinite(at) || at < slot - SENTENCE_LEAD_MS) return null;
  return slot;
}

/** The next 01:00 or 13:00 UTC, strictly after `now`. */
export function nextExecutionSlot(now: number = Date.now()): number {
  const date = new Date(now);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const candidates = [midnight + 3_600_000, midnight + 13 * 3_600_000];
  return candidates.find((t) => t > now) ?? midnight + DAY_MS + 3_600_000;
}
