import type { NumbersDb } from "@/lib/numbers";
import { CODES, SOURCES, scanSource, type SourceReport } from "@/lib/subsidies";

/**
 * Run every enabled source and write what it finds.
 *
 * Idempotent: the key is the person plus the label, so a second run updates the
 * row it wrote the first time. A source that fails reports the error and leaves
 * its rows alone — one dead website must not empty a page.
 *
 * Rows whose register states no figure are counted and not written. A row that
 * states a ceiling is written with qualifier "approved", which keeps it off the
 * money axis: a cap is not cash.
 */

function shortLabel(text: string, limit = 40): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

export async function runSubsidyScan(db: NumbersDb): Promise<SourceReport[]> {
  const reports: SourceReport[] = [];
  const checkedAt = new Date().toISOString();

  for (const source of SOURCES) {
    if (!source.enabled) {
      reports.push({
        id: source.id,
        label: source.label,
        jurisdiction: source.jurisdiction,
        ok: true,
        found: 0,
        refused: 0,
        written: 0,
        note: source.note ?? "source disabled",
      });
      continue;
    }

    let found = 0;
    let refused = 0;
    let written = 0;
    try {
      const { hits, refused: refusedRows } = await scanSource(source);
      refused = refusedRows;
      for (const hit of hits) {
        found += 1;
        if (hit.value == null) continue;
        const label = shortLabel(`${CODES[source.id] ?? source.jurisdiction} ${hit.program} ${hit.year ?? ""}`);
        const kind = hit.amountKind === "approved" ? "other" : "public_money";
        await db
          .prepare(
            `INSERT INTO person_numbers
               (slug, kind, label, display, value, unit, year, source_url, evidence_quote, confidence,
                checked_at, act_date, direction, instrument, counterparty, whose, evidence_grade,
                grade_basis, qualifier, review_status)
             VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, 95, ?, ?, 'in', ?, ?, 'firm', 'A', ?, ?, 'legacy')
             ON CONFLICT(slug, kind, label) DO UPDATE SET
               display = excluded.display,
               value = excluded.value,
               year = excluded.year,
               source_url = excluded.source_url,
               evidence_quote = excluded.evidence_quote,
               act_date = excluded.act_date,
               instrument = excluded.instrument,
               counterparty = excluded.counterparty,
               qualifier = excluded.qualifier,
               checked_at = excluded.checked_at`,
          )
          .bind(
            hit.slug,
            kind,
            label,
            hit.display,
            hit.value,
            hit.year,
            hit.sourceUrl,
            hit.quote,
            checkedAt,
            hit.date,
            hit.instrument,
            hit.counterparty,
            `${hit.jurisdiction}: ${hit.program}. Figure read from the source's own line, quoted verbatim.`,
            hit.amountKind === "approved" ? "approved" : "",
          )
          .run();
        written += 1;
      }
      reports.push({
        id: source.id,
        label: source.label,
        jurisdiction: source.jurisdiction,
        ok: true,
        found,
        refused,
        written,
        note: source.note ?? "",
      });
    } catch (err) {
      reports.push({
        id: source.id,
        label: source.label,
        jurisdiction: source.jurisdiction,
        ok: false,
        found,
        refused,
        written,
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return reports;
}
