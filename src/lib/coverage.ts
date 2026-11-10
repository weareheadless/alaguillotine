import type { ClockConfig } from "./clock-research";
import { researchDossierCase, type DossierCase } from "./dossier";
import { readQueue } from "./hate-store";
import { markCase, writeLedgerEntries } from "./ledger-write";
import { slugify } from "./slug";

/**
 * One full look per name.
 *
 * The wire pass only scores what the week's reporting says. It can add a name
 * on a single story and never touch them again: 40 names in the line, 17 with
 * no ledger at all. The standing dossiers do not reach those names either,
 * because they sweep a fixed list.
 *
 * So every queue name is registered here, once, and gets a bounded first look:
 * a handful of act-shaped searches, extraction under the dossier rules, and a
 * recorded outcome. "Nothing found" is a result, not a failure — the point is
 * that the same person is never standing in the line unread.
 */

type Result = { results?: Array<Record<string, unknown>> };

type Statement = {
  bind: (...v: unknown[]) => Statement;
  run: () => Promise<unknown>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Result>() => Promise<T>;
};

export type CoverageDb = { prepare: (q: string) => Statement };

export type CoverageStatus = "pending" | "running" | "done" | "failed";

export interface CoverageRow {
  slug: string;
  name: string;
  status: CoverageStatus;
  priority: number;
  attempts: number;
  entries: number;
  found: number;
  queries: number;
  sources: number;
  checkedAt: string | null;
  lastError: string;
}

const MAX_ATTEMPTS = 5;
/** A Worker that dies mid-pass leaves a running row; reclaim it after this. */
const STALE_MS = 45 * 60 * 1000;

const rowToCoverage = (r: Record<string, unknown>): CoverageRow => ({
  slug: String(r.slug ?? ""),
  name: String(r.name ?? ""),
  status: (String(r.status ?? "pending") as CoverageStatus) ?? "pending",
  priority: Number(r.priority ?? 0),
  attempts: Number(r.attempts ?? 0),
  entries: Number(r.entries ?? 0),
  found: Number(r.found ?? 0),
  queries: Number(r.queries ?? 0),
  sources: Number(r.sources ?? 0),
  checkedAt: r.checked_at == null ? null : String(r.checked_at),
  lastError: String(r.last_error ?? ""),
});

/**
 * Register every name currently in the line. Existing rows are left alone:
 * a done name is not sent back to the start because it was seen again.
 */
export async function registerQueueNames(db: CoverageDb): Promise<number> {
  let people: Array<{ name: string; role: string; country: string }> = [];
  try {
    people = (await readQueue(db)).map((f) => ({
      name: f.name,
      role: f.role,
      country: f.country,
    }));
  } catch {
    return 0;
  }
  if (!people.length) return 0;

  const existing = new Set<string>();
  try {
    const rows = await db.prepare("SELECT slug FROM name_investigations").bind().all();
    for (const r of rows.results ?? []) existing.add(String(r.slug ?? ""));
  } catch {
    return 0; // table not created yet
  }

  // A name with no ledger is the real gap and goes first.
  const counts = new Map<string, number>();
  try {
    const rows = await db
      .prepare("SELECT lower(person) AS n, COUNT(*) AS c FROM ledger_entries GROUP BY lower(person)")
      .bind()
      .all();
    for (const r of rows.results ?? []) counts.set(String(r.n ?? ""), Number(r.c ?? 0));
  } catch {
    /* ledger not created yet */
  }

  let added = 0;
  for (const p of people) {
    const slug = slugify(p.name);
    if (!slug || existing.has(slug)) continue;
    const ledger = counts.get(p.name.toLowerCase()) ?? 0;
    try {
      await db
        .prepare(
          `INSERT INTO name_investigations (slug, name, status, priority)
           VALUES (?, ?, 'pending', ?)`,
        )
        .bind(slug, p.name, ledger === 0 ? 0 : 1)
        .run();
      existing.add(slug);
      added += 1;
    } catch {
      return added;
    }
  }
  return added;
}

/**
 * A first look is deliberately narrower than a person dossier: six queries
 * across the categories that produce charges, one long window. It is enough
 * to establish whether there is a record, not to write the whole file.
 */
export function firstLookCase(person: {
  name: string;
  role: string;
  country: string;
}): DossierCase {
  const n = person.name;
  return {
    id: `firstlook:${slugify(n)}`,
    angle: "first look",
    person: n,
    role: person.role,
    country: person.country,
    place: person.country,
    after: "2018-01-01",
    before: `${new Date().getFullYear() + 1}-12-31`,
    subject: n,
    queries: [
      `"${n}" war civilians killed casualties`,
      `"${n}" repression crackdown protest arrested`,
      `"${n}" corruption indictment investigation fraud`,
      `"${n}" arms weapons deal contract`,
      `"${n}" lobbying donations conflict of interest`,
      `"${n}"`,
    ],
  };
}

export interface CoverageRun {
  name: string;
  status: CoverageStatus;
  entries: number;
  found: number;
  error?: string;
}

/**
 * Work the coverage queue. Returns what ran, so the cron output says whether
 * the line is being read or only claimed to be.
 */
export async function runCoverageBatch(
  db: CoverageDb,
  config: ClockConfig,
  batch: number,
): Promise<CoverageRun[]> {
  const now = new Date();
  try {
    await db
      .prepare(
        `UPDATE name_investigations
           SET status = 'failed', last_error = 'pass timed out', checked_at = ?
         WHERE status = 'running' AND (started_at IS NULL OR started_at < ?)`,
      )
      .bind(now.toISOString(), new Date(now.getTime() - STALE_MS).toISOString())
      .run();
  } catch {
    /* table not created yet */
  }

  let pending: CoverageRow[] = [];
  try {
    const rows = await db
      .prepare(
        `SELECT * FROM name_investigations
          WHERE status = 'pending'
             OR (status = 'failed' AND attempts < ?)
          ORDER BY priority ASC,
                   CASE status WHEN 'pending' THEN 0 ELSE 1 END,
                   checked_at ASC
          LIMIT ?`,
      )
      .bind(MAX_ATTEMPTS, batch)
      .all();
    pending = (rows.results ?? []).map(rowToCoverage);
  } catch {
    return [];
  }

  const run: CoverageRun[] = [];
  for (const row of pending) {
    let person = { name: row.name, role: "", country: "" };
    try {
      const q = await db
        .prepare("SELECT name, role, country FROM queue_people WHERE slug = ?")
        .bind(row.slug)
        .first<Record<string, unknown>>();
      if (q) {
        person = {
          name: String(q.name ?? row.name),
          role: String(q.role ?? ""),
          country: String(q.country ?? ""),
        };
      }
    } catch {
      /* use the registered name */
    }

    const started = new Date().toISOString();
    try {
      await db
        .prepare(
          `UPDATE name_investigations
             SET status = 'running', attempts = attempts + 1, started_at = ?
           WHERE slug = ?`,
        )
        .bind(started, row.slug)
        .run();
    } catch {
      continue;
    }

    const c = firstLookCase(person);
    try {
      const entries = await researchDossierCase(config, c);
      const { added, found } = await writeLedgerEntries(db, person.name, entries);
      await markCase(db, c.id, added);
      const sources = new Set(entries.flatMap((e) => e.sources)).size;
      await db
        .prepare(
          `UPDATE name_investigations
             SET status = 'done', entries = ?, found = ?, queries = ?, sources = ?,
                 checked_at = ?, last_error = ''
           WHERE slug = ?`,
        )
        .bind(
          added,
          found,
          c.queries.length,
          sources,
          new Date().toISOString(),
          row.slug,
        )
        .run();
      run.push({ name: person.name, status: "done", entries: added, found });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "unknown error";
      await db
        .prepare(
          `UPDATE name_investigations
             SET status = 'failed', checked_at = ?, last_error = ?
           WHERE slug = ?`,
        )
        .bind(new Date().toISOString(), message, row.slug)
        .run();
      run.push({ name: person.name, status: "failed", entries: 0, found: 0, error: message });
    }
  }

  return run;
}

export interface CoverageSummary {
  total: number;
  pending: number;
  running: number;
  done: number;
  failed: number;
  unread: number;
  rows: CoverageRow[];
}

export async function coverageSummary(
  db: CoverageDb,
  includeRows = false,
): Promise<CoverageSummary> {
  const empty: CoverageSummary = {
    total: 0,
    pending: 0,
    running: 0,
    done: 0,
    failed: 0,
    unread: 0,
    rows: [],
  };
  try {
    const counts = await db
      .prepare("SELECT status, COUNT(*) AS n FROM name_investigations GROUP BY status")
      .bind()
      .all();
    for (const r of counts.results ?? []) {
      const n = Number(r.n ?? 0);
      const status = String(r.status ?? "");
      if (status === "pending") empty.pending += n;
      else if (status === "running") empty.running += n;
      else if (status === "done") empty.done += n;
      else if (status === "failed") empty.failed += n;
      empty.total += n;
    }
    empty.unread = empty.total - empty.done;
    if (includeRows) {
      const rows = await db
        .prepare(
          `SELECT * FROM name_investigations
            ORDER BY CASE status WHEN 'done' THEN 1 ELSE 0 END, priority, name`,
        )
        .bind()
        .all();
      empty.rows = (rows.results ?? []).map(rowToCoverage);
    }
    return empty;
  } catch {
    return empty;
  }
}

/** Lightweight map for the queue API. Missing means "not read yet". */
export async function coverageBySlug(
  db: CoverageDb,
): Promise<Map<string, { status: CoverageStatus; checkedAt: string | null; entries: number }>> {
  const map = new Map<
    string,
    { status: CoverageStatus; checkedAt: string | null; entries: number }
  >();
  try {
    const rows = await db
      .prepare("SELECT slug, status, checked_at, entries FROM name_investigations")
      .bind()
      .all();
    for (const r of rows.results ?? []) {
      map.set(String(r.slug ?? ""), {
        status: (String(r.status ?? "pending") as CoverageStatus) ?? "pending",
        checkedAt: r.checked_at == null ? null : String(r.checked_at),
        entries: Number(r.entries ?? 0),
      });
    }
  } catch {
    /* table not created yet */
  }
  return map;
}
