import type { LedgerEntry } from "./backfill";
import { slugify } from "./slug";

/**
 * Writing charges to the ledger.
 *
 * Two sweeps can find the same act in different words. A shared figure is
 * confirmation ("the $148,378 penalty"), while two different numbers are two
 * different charges. This is the one place that decides what is already on
 * record, so a first look and a dossier pass cannot file the same act twice.
 */

export type LedgerDb = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      run: () => Promise<unknown>;
      all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
    };
  };
};

const actHash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The row id for an act: one person, one wording, one charge. */
export const actKey = (person: string, act: string): string =>
  `${slugify(person)}:${actHash(norm(act))}`;

/**
 * A bare year is not evidence of the same act: two things happen in 2026.
 * It is filtered out of the figure comparison so that a shared year alone
 * cannot collapse two charges.
 */
const isYear = (n: string) => /^\d{4}$/.test(n) && Number(n) >= 1900 && Number(n) <= 2099;

export function sameAct(a: string, b: string): boolean {
  const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 3));
  const figures = (s: string) =>
    new Set(
      (s.match(/\d[\d,.]*/g) ?? [])
        .map((n) => n.replace(/[.,]$/, ""))
        .filter((n) => !isYear(n)),
    );

  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return false;
  let overlap = 0;
  for (const w of A) if (B.has(w)) overlap += 1;
  const contained = overlap / Math.min(A.size, B.size);
  if (contained >= 0.7) return true;

  const FA = figures(a);
  const FB = figures(b);
  if (!FA.size || !FB.size) return false;

  // The same event, written twice by two desks in two languages, keeps the
  // figures the model carries across: the date and the death toll, the fine
  // and the year. Two shared figures with no shared words is the signature of
  // exactly that, and it is how an Arabic and an English account of one
  // massacre stop being filed as two charges.
  let shared = 0;
  for (const n of FA) if (FB.has(n)) shared += 1;
  if (shared >= 2) return true;

  for (const n of FA) if (FB.has(n)) return contained >= 0.5;
  return false;
}

/** Write new charges for one person. Returns how many were actually added. */
export async function writeLedgerEntries(
  db: LedgerDb,
  person: string,
  entries: LedgerEntry[],
): Promise<{ added: number; found: number }> {
  const known: string[] = [];
  try {
    const rows = await db
      .prepare("SELECT act FROM ledger_entries WHERE lower(person) = lower(?)")
      .bind(person)
      .all();
    for (const r of rows.results ?? []) known.push(String(r.act ?? ""));
  } catch {
    /* first run for this name */
  }

  let added = 0;
  for (const e of entries) {
    if (known.some((act) => sameAct(act, e.act))) continue;
    known.push(e.act);
    added += 1;
    await db
      .prepare(
        `INSERT INTO ledger_entries (id, person, role, act, place, year, category, confidence, sources, case_id, created_at, attribution, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
         ON CONFLICT(id) DO UPDATE SET act = excluded.act, confidence = excluded.confidence, sources = excluded.sources, attribution = excluded.attribution`,
      )
      .bind(
        actKey(e.person, e.act),
        e.person,
        e.role,
        e.act,
        e.place,
        e.year,
        e.category,
        e.confidence,
        JSON.stringify(e.sources),
        e.caseId,
        new Date().toISOString(),
        e.attribution ?? 1,
      )
      .run();
  }

  return { added, found: entries.length };
}

/** Record that a case ran, even when it found nothing. */
export async function markCase(db: LedgerDb, caseId: string, entries: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ledger_cases (case_id, attempted_at, entries)
       VALUES (?, ?, ?)
       ON CONFLICT(case_id) DO UPDATE SET attempted_at = excluded.attempted_at, entries = excluded.entries`,
    )
    .bind(caseId, new Date().toISOString(), entries)
    .run();
}
