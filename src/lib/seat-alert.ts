/**
 * The seat alert.
 *
 * "Reserve a seat" is a promise to be warned before the blade falls, so the
 * arithmetic lives here rather than inside the button: how long until the
 * five-minute warning, and what to remember between visits.
 */
export const SEAT_ALERT_LEAD_MS = 5 * 60 * 1000;

export interface SeatReservation {
  /** The performance being reserved. */
  at: string;
  name: string;
  slug: string;
}

/**
 * Milliseconds until the warning, 0 if the warning window is already open, or
 * null when the performance has passed or the time cannot be read.
 */
export function seatAlertDelay(
  at: string,
  now = Date.now(),
  lead = SEAT_ALERT_LEAD_MS,
): number | null {
  const execution = Date.parse(at);
  if (!Number.isFinite(execution) || execution <= now) return null;
  return Math.max(0, execution - lead - now);
}

/** "16:55 UTC" — the warning time, shown before anybody commits. */
export function seatAlertLabel(at: string, lead = SEAT_ALERT_LEAD_MS): string {
  const execution = Date.parse(at);
  if (!Number.isFinite(execution)) return "";
  const warn = new Date(execution - lead);
  return `${String(warn.getUTCHours()).padStart(2, "0")}:${String(
    warn.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
}

/** A stored reservation, or null when the value is absent or malformed. */
export function parseReservation(raw: string | null): SeatReservation | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SeatReservation>;
    if (
      typeof value.at !== "string" ||
      !Number.isFinite(Date.parse(value.at)) ||
      typeof value.name !== "string" ||
      !value.name.trim() ||
      typeof value.slug !== "string" ||
      !value.slug.trim()
    ) {
      return null;
    }
    return { at: value.at, name: value.name, slug: value.slug };
  } catch {
    return null;
  }
}
