import type { Figure, HateState } from "./hateometer";
import { slugify } from "./slug";

/**
 * The appointment, in one object.
 *
 * The blade is a ritual, so the site should be able to say who is on the block,
 * when it falls, and what the charge is. The name comes from the sentence and
 * nowhere else: if no sentence exists there is no appointment, and the ticker
 * says nothing rather than forecasting one.
 */
export interface ExecutionNotice {
  name: string;
  slug: string;
  /** The short charge, not the whole paragraph. */
  reason: string;
  /** ISO timestamp of the appointment. */
  at: string;
  /** "WED 11 NOV" */
  dateLabel: string;
  /** "09:00 UTC" */
  timeLabel: string;
  /** A sentence is always waiting when this object exists. */
  confirmed: boolean;
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** The first charge on record, or the first clause of the reason. */
export function shortCharge(figure: Figure, limit = 118): string {
  const reason = (figure.reason || "").replace(/\s+/g, " ").trim();
  const clause = reason.split(/[;—]|\.\s/)[0]?.trim() ?? "";
  const charge = (figure.topCharges?.[0]?.act || "").replace(/\s+/g, " ").trim();
  const raw = clause.length >= 24 ? clause : charge || reason;
  if (!raw) return "the record speaks for itself";
  const first = raw.split(/(?<=[.!?])\s+/)[0] ?? raw;
  const text =
    first.length <= limit
      ? first
      : `${first.slice(0, limit - 1).replace(/\s+\S*$/, "")}…`;
  return text.replace(/[.!?]+$/, "");
}

function label(at: string): { dateLabel: string; timeLabel: string } {
  const d = new Date(at);
  const dateLabel = `${DAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
  const timeLabel = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  return { dateLabel, timeLabel };
}

export function executionNotice(
  state: HateState,
  _now: number = Date.now(),
): ExecutionNotice | null {
  // No sentence, no appointment. The ticker used to fall back to the top of
  // the line and stamp it with the next public hour, which promised a name and
  // a time the system had not committed to; the name could change before the
  // sentence was ever written, and often did.
  const execution = state.execution;
  if (!execution) return null;

  const figure =
    state.figures.find((f) => slugify(f.name) === execution.slug) ?? null;
  const { dateLabel, timeLabel } = label(execution.executeAt);

  return {
    name: figure?.name ?? execution.person,
    slug: execution.slug,
    reason: figure ? shortCharge(figure) : "the record speaks for itself",
    at: execution.executeAt,
    dateLabel,
    timeLabel,
    confirmed: true,
  };
}

/** "02:14:09" or "14:09" — the same shape the blade clock uses. */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
