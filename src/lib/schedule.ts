/**
 * The ritual's timetable.
 *
 * Ada reads the record twice a day, at 00:30 and 12:30 UTC. The blade falls at
 * fixed public hours through the day — 09:00, 13:00, 17:00 and 21:00 UTC — one
 * name per appointment, so a backlog is spaced across the day instead of
 * stacking four heads on the same block. Nothing here is a promise: the
 * reading can slip, and the band can be empty.
 */

/** Public execution hours, UTC. One blade per slot. */
export const EXECUTION_HOURS = [9, 13, 17, 21] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The latest a reading may be and still sentence the coming slot. */
const MAX_READING_AGE_MS = 24 * 60 * 60 * 1000;

/** The next 00:30 or 12:30 UTC, strictly after `now`. */
export function nextReadingAt(now: number = Date.now()): number {
  const date = new Date(now);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const candidates = [midnight + 30 * 60_000, midnight + 12.5 * 3_600_000];
  return candidates.find((t) => t > now) ?? midnight + DAY_MS + 30 * 60_000;
}

/**
 * The slot a sentence created at `now` would run to, or null when the reading
 * is too old to describe the queue.
 *
 * There is no thirty-minute lead any more. A sentence used to be created only
 * in the half hour before a slot, which meant the appointment existed only if
 * someone happened to load the site in that window: four half-hours a day, and
 * the rest of the time the ticker showed a name that had not been sentenced.
 * A sentence now stands from the moment the reading lands until the blade
 * falls, so the name on the ticker is the name on the block.
 */
export function sentenceSlot(
  now: number,
  readingAt: string | null | undefined,
): number | null {
  const slot = nextExecutionSlot(now);
  const at = readingAt ? Date.parse(readingAt) : NaN;
  if (!Number.isFinite(at) || at > slot) return null;
  if (slot - at > MAX_READING_AGE_MS) return null;
  return slot;
}

/** The next public execution hour, strictly after `now`. */
export function nextExecutionSlot(now: number = Date.now()): number {
  const date = new Date(now);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  for (const hour of EXECUTION_HOURS) {
    const t = midnight + hour * 3_600_000;
    if (t > now) return t;
  }
  return midnight + DAY_MS + EXECUTION_HOURS[0] * 3_600_000;
}
