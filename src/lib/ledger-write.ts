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

export function sameAct(a: string, b: string): boolean {
  const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 3));
  const figures = (s: string) =>
    new Set((s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[.,]$/, "")));

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
        `INSERT INTO ledger_entries (id, person, role, act, place, year, category, confidence, sources, case_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET act = excluded.act, confidence = excluded.confidence, sources = excluded.sources`,
      )
      .bind(
        `${slugify(e.person)}:${actHash(norm(e.act))}`,
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
