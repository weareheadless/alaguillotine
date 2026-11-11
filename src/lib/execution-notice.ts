import type { Figure, HateState } from "./hateometer";
import { nextExecutionSlot } from "./schedule";
import { slugify } from "./slug";

/**
 * The appointment, in one object.
 *
 * The blade is a ritual, so the site should be able to say who is on the block,
 * when it falls, and what the charge is — not just "the next blade is
 * confirmed". The name comes from the sentence when one exists; otherwise the
 * top of the line is the name the next reading will sentence.
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
  /** True when a sentence is already waiting, false when it is the next slot. */
  confirmed: boolean;
  /** The next name in the line, at the following public hour. */
  following?: {
    name: string;
    slug: string;
    dateLabel: string;
    timeLabel: string;
  } | null;
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
  now: number = Date.now(),
): ExecutionNotice | null {
  const execution = state.execution;
  const figure = execution
    ? state.figures.find((f) => slugify(f.name) === execution.slug) ?? null
    : state.figures[0] ?? null;
  if (!figure) return null;

  const at = execution?.executeAt ?? new Date(nextExecutionSlot(now)).toISOString();
  const { dateLabel, timeLabel } = label(at);

  // The line is the schedule: the next name after this one takes the next
  // public hour. It is a programme, not a single booking.
  const index = state.figures.findIndex(
    (f) => slugify(f.name) === slugify(figure.name),
  );
  const nextFigure = index >= 0 ? state.figures[index + 1] ?? null : null;
  const nextAt = new Date(nextExecutionSlot(Date.parse(at))).toISOString();
  const nextLabel = label(nextAt);
  const following = nextFigure
    ? {
        name: nextFigure.name,
        slug: slugify(nextFigure.name),
        dateLabel: nextLabel.dateLabel,
        timeLabel: nextLabel.timeLabel,
      }
    : null;

  return {
    name: figure.name,
    slug: execution?.slug ?? slugify(figure.name),
    reason: shortCharge(figure),
    at,
    dateLabel,
    timeLabel,
    confirmed: Boolean(execution),
    following,
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
