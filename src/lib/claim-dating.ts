import type { D1 } from "./clock-store";

/**
 * Dating the record.
 *
 * A claim with only a year cannot be placed in a news cycle, and the feed now
 * refuses anything it cannot date inside a day. Most claims were filed with a
 * year and a sentence that already contains the exact date — "On 10 November
 * 2026", "in April 2025" — so the date is read from the claim rather than
 * inferred from the year. Month-only and year-only stay undated; a made-up day
 * is worse than no day.
 */

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH_PATTERN =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * The first full date in a sentence, or null.
 *
 * Full means a day, a month and a year: "10 November 2026", "November 10,
 * 2026", "10 Nov 2026", "2026-11-10". A bare month or year is deliberately not
 * a match — those cannot be placed on a day without inventing one.
 */
export function dateFromText(text: string): string | null {
  const value = String(text ?? "");

  const dashed = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (dashed) {
    return iso(Number(dashed[1]), Number(dashed[2]), Number(dashed[3]));
  }

  const dayFirst = value.match(
    new RegExp(`\\b(\\d{1,2})\\s+(?:${MONTH_PATTERN})\\.?,?\\s+(20\\d{2})\\b`, "i"),
  );
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase().replace(/\.$/, "")];
    if (month) return iso(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }

  const monthFirst = value.match(
    new RegExp(`\\b(?:${MONTH_PATTERN})\\.?\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`, "i"),
  );
  if (monthFirst) {
    const name = monthFirst[0].trim().toLowerCase().replace(/[\s,].*$/, "").replace(/\.$/, "");
    const month = MONTHS[name];
    if (month) return iso(Number(monthFirst[2]), month, Number(monthFirst[1]));
  }

  return null;
}

/**
 * Day and month with no year, resolved against the year the claim records.
 *
 * "On 13 November" is not a guess about the year: the claim already carries
 * it. What would be a guess is inventing a day, which this never does.
 */
export function dateWithYear(text: string, year: number): string | null {
  if (!year || year < 1900 || year > 2200) return null;
  const match = String(text ?? "").match(
    new RegExp(`\\b(\\d{1,2})\\s+(?:${MONTH_PATTERN})\\b`, "i"),
  );
  if (!match) return null;
  const name = match[0].trim().toLowerCase().split(/\s+/)[1]?.replace(/\.$/, "") ?? "";
  const month = MONTHS[name];
  if (!month) return null;
  return iso(year, month, Number(match[1]));
}

export interface DatingReport {
  seen: number;
  dated: number;
  recent: number;
  /** Claims whose text carries a day and a month but no year. */
  partial: number;
}

/**
 * Date the undated claims of ranked names, newest first.
 *
 * Only the sentence is read. Nothing is taken from the source URL, because a
 * publication date is when the story ran, not when the act happened — and
 * presenting one as the other is exactly the fabrication this is meant to
 * avoid.
 */
export async function dateClaims(db: D1, limit = 200): Promise<DatingReport> {
  const rows = await db
    .prepare(
      `SELECT le.id, le.act, le.evidence_quote, le.year
         FROM ledger_entries le
         JOIN queue_people qp ON lower(qp.name) = lower(le.person)
        WHERE le.act_date IS NULL
          AND (le.review_status IN ('accepted', 'legacy'))
        ORDER BY COALESCE(qp.rank, 9999) ASC, le.created_at DESC
        LIMIT ?`,
    )
    .bind(Math.min(500, Math.max(1, limit)))
    .all();

  const items = (rows.results ?? []).map((row) => ({
    id: String(row.id ?? ""),
    act: String(row.act ?? ""),
    quote: String(row.evidence_quote ?? ""),
    year: Number(row.year ?? 0),
  }));

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  let dated = 0;
  let recent = 0;
  let partial = 0;

  for (const item of items) {
    if (!item.id) continue;
    const found =
      dateFromText(item.act) ??
      dateFromText(item.quote) ??
      dateWithYear(item.act, item.year) ??
      dateWithYear(item.quote, item.year);
    if (!found) {
      // A day and a month but no year is not nothing: it is why the claim
      // cannot be placed. Counting it keeps the gap visible.
      if (/\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(item.act)) {
        partial += 1;
      }
      continue;
    }
    await db
      .prepare(
        "UPDATE ledger_entries SET act_date = ?, date_precision = 'day' WHERE id = ? AND act_date IS NULL",
      )
      .bind(found, item.id)
      .run();
    dated += 1;
    if (found >= yesterday) recent += 1;
  }

  return { seen: items.length, dated, recent, partial };
}
