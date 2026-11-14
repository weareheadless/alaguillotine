import { getCloudflareContext } from "@opennextjs/cloudflare";
import { actDate, EVIDENCE_WINDOW_DAYS, evidenceFor } from "./evidence";
import { slugify } from "./slug";

type Stmt = {
  bind: (...v: unknown[]) => Stmt;
  run: () => Promise<unknown>;
  all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
};
type D1 = { prepare: (q: string) => Stmt };

async function db(): Promise<D1 | null> {
  const ctx = (await getCloudflareContext({ async: true })) as unknown as { env?: { D1?: D1 } };
  return ctx.env?.D1 ?? null;
}

export interface ArchiveRow {
  id: string;
  headline: string;
  fact: string;
  quip: string;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  rage: number;
  firstSeen: string;
  lastSeen: string;
}

/** Nothing Ada reads is thrown away: every item is kept, forever. */
export async function archiveItems(
  items: Array<{
    id: string;
    headline: string;
    fact: string;
    quip: string;
    source: string;
    sourceUrl: string;
    publishedAt: string | null;
    rage: number;
  }>,
): Promise<void> {
  const d = await db();
  if (!d) return;
  const now = new Date().toISOString();
  for (const i of items) {
    await d
      .prepare(
        `INSERT INTO archive_items (id, headline, fact, quip, source, source_url, published_at, rage, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           rage = excluded.rage, last_seen = excluded.last_seen, headline = excluded.headline`,
      )
      .bind(i.id, i.headline, i.fact, i.quip, i.source, i.sourceUrl, i.publishedAt, i.rage, now, now)
      .run();
  }
}

export interface LedgerRow {
  id: string;
  person: string;
  role: string;
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  attribution: number;
  sources: string[];
  /** pending | accepted | rejected | legacy */
  reviewStatus: string;
  reviewNote: string;
  actDate: string | null;
  datePrecision: string;
  evidenceQuote: string;
  sourceLang: string;
  createdAt: string;
  /** A/B/C/D — how well the conduct is established. */
  grade: string;
  /** charged | convicted | investigated | settled | no_action | blocked | unknown */
  outcome: string;
  gradeBasis: string;
}

export interface LedgerQuery {
  person?: string;
  year?: number;
  category?: string;
  status?: string;
  page?: number;
  per?: number;
}

export interface LedgerPage {
  rows: LedgerRow[];
  total: number;
  page: number;
  pages: number;
  per: number;
}

/**
 * The archive, one receipt at a time.
 *
 * The site kept a ledger and gave nobody a way to read it: the charges were
 * reachable only from a name that already stood in the line. This is the index
 * — filter by name, year or category, page through the whole record, newest
 * filing first.
 */
export async function listLedger(query: LedgerQuery = {}): Promise<LedgerPage> {
  const d = await db();
  const per = Math.min(100, Math.max(10, query.per ?? 40));
  const page = Math.max(1, query.page ?? 1);
  if (!d) return { rows: [], total: 0, page: 1, pages: 1, per };

  const where: string[] = [];
  const binds: unknown[] = [];

  if (query.person) {
    where.push("lower(person) LIKE ?");
    binds.push(`%${query.person.trim().toLowerCase()}%`);
  }
  if (Number.isFinite(query.year) && query.year) {
    where.push("year = ?");
    binds.push(query.year);
  }
  if (query.category) {
    where.push("lower(category) = ?");
    binds.push(query.category.trim().toLowerCase());
  }
  if (query.status && query.status !== "all") {
    where.push("review_status = ?");
    binds.push(query.status);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRow = await d
    .prepare(`SELECT COUNT(*) AS n FROM ledger_entries ${clause}`)
    .bind(...binds)
    .first<{ n?: number }>();
  const total = Number(countRow?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / per));
  const safePage = Math.min(page, pages);

  const rows = await d
    .prepare(
      `SELECT id, person, role, act, place, year, category, confidence, attribution, sources,
              review_status, review_note, act_date, date_precision, evidence_quote, source_lang,
              created_at, evidence_grade, institutional_status, grade_basis
         FROM ledger_entries ${clause}
        ORDER BY year DESC, created_at DESC, rowid DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(...binds, per, (safePage - 1) * per)
    .all();

  return {
    total,
    page: safePage,
    pages,
    per,
    rows: (rows.results ?? []).map((r) => {
      let sources: string[] = [];
      try {
        sources = JSON.parse(String(r.sources ?? "[]")) as string[];
      } catch {
        sources = [];
      }
      return {
        id: String(r.id),
        person: String(r.person ?? ""),
        role: String(r.role ?? ""),
        act: String(r.act ?? ""),
        place: String(r.place ?? ""),
        year: Number(r.year ?? 0),
        category: String(r.category ?? ""),
        confidence: Number(r.confidence ?? 0),
        attribution: Number(r.attribution ?? 1),
        sources,
        reviewStatus: String(r.review_status ?? "legacy"),
        reviewNote: String(r.review_note ?? ""),
        actDate: r.act_date == null ? null : String(r.act_date),
        datePrecision: String(r.date_precision ?? "year"),
        evidenceQuote: String(r.evidence_quote ?? ""),
        sourceLang: String(r.source_lang ?? ""),
        createdAt: String(r.created_at ?? ""),
        grade: String(r.evidence_grade ?? ""),
        outcome: String(r.institutional_status ?? "unknown"),
        gradeBasis: String(r.grade_basis ?? ""),
      };
    }),
  };
}

/** One claim, by id, with everything the evidence page needs. */
export async function getLedgerEntry(id: string): Promise<LedgerRow | null> {
  const d = await db();
  if (!d || !id) return null;
  const r = await d
    .prepare(
      `SELECT id, person, role, act, place, year, category, confidence, attribution, sources,
              review_status, review_note, act_date, date_precision, evidence_quote, source_lang,
              created_at, evidence_grade, institutional_status, grade_basis
         FROM ledger_entries WHERE id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!r) return null;
  let sources: string[] = [];
  try {
    sources = JSON.parse(String(r.sources ?? "[]")) as string[];
  } catch {
    sources = [];
  }
  return {
    id: String(r.id),
    person: String(r.person ?? ""),
    role: String(r.role ?? ""),
    act: String(r.act ?? ""),
    place: String(r.place ?? ""),
    year: Number(r.year ?? 0),
    category: String(r.category ?? ""),
    confidence: Number(r.confidence ?? 0),
    attribution: Number(r.attribution ?? 1),
    sources,
    reviewStatus: String(r.review_status ?? "legacy"),
    reviewNote: String(r.review_note ?? ""),
    actDate: r.act_date == null ? null : String(r.act_date),
    datePrecision: String(r.date_precision ?? "year"),
    evidenceQuote: String(r.evidence_quote ?? ""),
    sourceLang: String(r.source_lang ?? ""),
    createdAt: String(r.created_at ?? ""),
    grade: String(r.evidence_grade ?? ""),
    outcome: String(r.institutional_status ?? "unknown"),
    gradeBasis: String(r.grade_basis ?? ""),
  };
}

export interface LedgerRevision {
  from: string;
  to: string;
  note: string;
  reviewer: string;
  at: string;
}

/** Every review decision about one claim, newest first. */
export async function ledgerRevisions(id: string): Promise<LedgerRevision[]> {
  const d = await db();
  if (!d || !id) return [];
  try {
    const rows = await d
      .prepare(
        `SELECT from_status, to_status, note, reviewer, at
           FROM ledger_revisions WHERE entry_id = ? ORDER BY at DESC LIMIT 40`,
      )
      .bind(id)
      .all();
    return (rows.results ?? []).map((r) => ({
      from: String(r.from_status ?? ""),
      to: String(r.to_status ?? ""),
      note: String(r.note ?? ""),
      reviewer: String(r.reviewer ?? ""),
      at: String(r.at ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function ledgerFacets(): Promise<{
  total: number;
  people: number;
  years: Array<{ year: number; n: number }>;
  categories: Array<{ category: string; n: number }>;
  statuses: Array<{ status: string; n: number }>;
}> {
  const d = await db();
  if (!d) return { total: 0, people: 0, years: [], categories: [], statuses: [] };
  try {
    const [totals, years, categories, statuses] = await Promise.all([
      d
        .prepare("SELECT COUNT(*) AS n, COUNT(DISTINCT lower(person)) AS p FROM ledger_entries")
        .bind()
        .first<{ n?: number; p?: number }>(),
      d
        .prepare(
          "SELECT year, COUNT(*) AS n FROM ledger_entries GROUP BY year ORDER BY year DESC",
        )
        .bind()
        .all(),
      d
        .prepare(
          "SELECT lower(category) AS c, COUNT(*) AS n FROM ledger_entries GROUP BY c ORDER BY n DESC",
        )
        .bind()
        .all(),
      d
        .prepare(
          "SELECT review_status AS s, COUNT(*) AS n FROM ledger_entries GROUP BY s ORDER BY n DESC",
        )
        .bind()
        .all(),
    ]);
    return {
      total: Number(totals?.n ?? 0),
      people: Number(totals?.p ?? 0),
      years: ((years.results ?? []) as Array<Record<string, unknown>>)
        .map((r) => ({ year: Number(r.year ?? 0), n: Number(r.n ?? 0) }))
        .filter((r) => r.year > 1900),
      categories: ((categories.results ?? []) as Array<Record<string, unknown>>)
        .map((r) => ({ category: String(r.c ?? ""), n: Number(r.n ?? 0) }))
        .filter((r) => r.category),
      statuses: ((statuses.results ?? []) as Array<Record<string, unknown>>)
        .map((r) => ({ status: String(r.s ?? "legacy"), n: Number(r.n ?? 0) }))
        .filter((r) => r.status),
    };
  } catch {
    return { total: 0, people: 0, years: [], categories: [], statuses: [] };
  }
}

export async function listArchive(limit = 100): Promise<ArchiveRow[]> {
  const d = await db();
  if (!d) return [];
  const rows = await d
    .prepare(
      "SELECT id, headline, fact, quip, source, source_url, published_at, rage, first_seen, last_seen FROM archive_items ORDER BY last_seen DESC LIMIT ?",
    )
    .bind(limit)
    .all();
  return (rows.results ?? []).map((r) => ({
    id: String(r.id),
    headline: String(r.headline),
    fact: String(r.fact ?? ""),
    quip: String(r.quip ?? ""),
    source: String(r.source ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    publishedAt: r.published_at == null ? null : String(r.published_at),
    rage: Number(r.rage ?? 0),
    firstSeen: String(r.first_seen),
    lastSeen: String(r.last_seen),
  }));
}

export async function archiveCount(): Promise<number> {
  const d = await db();
  if (!d) return 0;
  const rows = await d.prepare("SELECT COUNT(*) AS n FROM archive_items").all<{
    results?: Array<{ n: number }>;
  }>();
  return Number(rows.results?.[0]?.n ?? 0);
}

export interface LedgerEntry {
  id: string;
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  sources: string[];
  /** ISO date when a reviewer established one, else null. */
  actDate: string | null;
  /** A/B/C/D. */
  grade: string;
  /** charged | convicted | investigated | settled | sanctioned | no_action | blocked | unknown */
  outcome: string;
  /** pending | accepted | rejected | legacy */
  status: string;
}

/**
 * Names are written many ways across two years of wire copy. Exact matching
 * alone leaves the ledger looking empty while the entries sit right there, so
 * a name also matches on its distinctive tokens ("Elon Musk" → elon, musk).
 */
/**
 * A name is matched on its first and last part, never on one token.
 *
 * The old match took any word over three letters, so "Henry Cuellar" also
 * pulled in every other Henry on the floor — and since a roll call gives a
 * whole caucus the same words, the page repeated the same vote under different
 * people. First and last together is the smallest pair that is still one person.
 */
export function namePair(name: string): string[] {
  const inside = (name.match(/\(([^)]+)\)/g) ?? []).map((s) => s.slice(1, -1));
  const parts = `${name.replace(/\([^)]*\)/g, " ")} ${inside.join(" ")}`
    .split(/\s+/)
    .map((t) => t.replace(/[.,]/g, "").trim().toLowerCase())
    .filter((t) => t.length >= 2);
  if (parts.length === 0) return [];
  return [parts[0], parts[parts.length - 1]];
}

export function nameTokens(name: string): string[] {
  const inside = (name.match(/\(([^)]+)\)/g) ?? []).map((s) => s.slice(1, -1));
  const base = name.replace(/\([^)]*\)/g, " ");
  return Array.from(
    new Set(
      `${base} ${inside.join(" ")}`
        .split(/\s+/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 4),
    ),
  );
}

export function countLedger(
  rows: Array<{ person: string; count: number }>,
  name: string,
): number {
  const lower = name.toLowerCase();
  const [first, last] = namePair(name);
  let total = 0;
  for (const r of rows) {
    const p = r.person.toLowerCase();
    if (p === lower) total += r.count;
    else if (first && last && p.includes(first) && p.includes(last)) total += r.count;
  }
  return total;
}

export async function getLedgerFor(name: string): Promise<LedgerEntry[]> {
  const d = await db();
  if (!d) return [];
  const [first, last] = namePair(name);
  const where = first && last
    ? "lower(person) = lower(?) OR (lower(person) LIKE ? AND lower(person) LIKE ?)"
    : "lower(person) = lower(?)";
  const rows = await d
    .prepare(
      `SELECT id, act, place, year, category, confidence, sources, attribution, act_date,
              evidence_grade, institutional_status, review_status
         FROM ledger_entries WHERE ${where} ORDER BY confidence DESC, year DESC LIMIT 80`,
    )
    .bind(name, ...(first && last ? [`%${first}%`, `%${last}%`] : []))
    .all();
  return (rows.results ?? []).map((r) => {
    let sources: string[] = [];
    try {
      sources = JSON.parse(String(r.sources ?? "[]")) as string[];
    } catch {
      sources = [];
    }
    return {
      id: String(r.id ?? ""),
      act: String(r.act ?? ""),
      place: String(r.place ?? ""),
      year: Number(r.year ?? 0),
      category: String(r.category ?? ""),
      confidence: Number(r.confidence ?? 0),
      sources,
      actDate: r.act_date == null ? null : String(r.act_date),
      grade: String(r.evidence_grade ?? ""),
      outcome: String(r.institutional_status ?? "unknown"),
      status: String(r.review_status ?? "legacy"),
    };
  });
}

/**
 * What the person was, and when.
 *
 * The terms are stored with a precision flag, so a role known only by its year
 * is not drawn as if it began on the first of January. The page draws them as
 * bands above the record; the overlap with a payment is then visible without
 * anyone having to say "conflict of interest" out loud.
 */
export interface PositionRow {
  id: string;
  role: string;
  org: string;
  kind: string;
  fromDate: string;
  toDate: string | null;
  precision: string;
  sourceUrl: string;
  note: string;
}

export async function getPositionsFor(slug: string): Promise<PositionRow[]> {
  const d = await db();
  if (!d) return [];
  try {
    const rows = await d
      .prepare(
        `SELECT id, role, org, kind, from_date, to_date, date_precision, source_url, note
           FROM positions WHERE slug = ? ORDER BY from_date`,
      )
      .bind(slug)
      .all();
    return (rows.results ?? []).map((r) => ({
      id: String(r.id ?? ""),
      role: String(r.role ?? ""),
      org: String(r.org ?? ""),
      kind: String(r.kind ?? "state"),
      fromDate: String(r.from_date ?? ""),
      toDate: r.to_date == null ? null : String(r.to_date),
      precision: String(r.date_precision ?? "day"),
      sourceUrl: String(r.source_url ?? ""),
      note: String(r.note ?? ""),
    }));
  } catch {
    // Table not migrated yet.
    return [];
  }
}

/**
 * The record, summarised for the page and the queue.
 *
 * The number the line shows is now computed here: the harm of the acts inside
 * the window, weighted by confidence and category. The lifetime count stays as
 * context, never as a floor.
 */
export interface LedgerSummary {
  count: number;
  avgConfidence: number;
  maxConfidence: number;
  recent: number;
  /** Acts inside the evidence window, weighted. */
  windowActs: number;
  /** 0–100, from `evidenceFor`. */
  evidence: number;
  /** The newest credible act inside the window, for the card. */
  newest: {
    act: string;
    place: string;
    year: number;
    category: string;
    confidence: number;
    date: string | null;
  } | null;
  top: Array<{
    act: string;
    place: string;
    year: number;
    category: string;
    confidence: number;
    attribution?: number;
    actDate?: string | null;
    grade?: string;
  }>;
}

export async function readLedgerSummaries(): Promise<Map<string, LedgerSummary>> {
  const d = await db();
  if (!d) return new Map();

  // Spelling is not identity. Rows filed under an approved alias count toward
  // the canonical name, so a person is not reduced to the spelling a subeditor
  // happened to use.
  const aliases = new Map<string, string>();
  try {
    const aliasRows = await d
      .prepare("SELECT alias, canonical FROM person_aliases")
      .bind()
      .all();
    for (const a of aliasRows.results ?? []) {
      const alias = String(a.alias ?? "").trim().toLowerCase();
      const canonical = String(a.canonical ?? "").trim();
      if (alias && canonical) aliases.set(alias, canonical);
    }
  } catch {
    /* table not created yet */
  }
  const canonicalKey = (name: string): string => {
    const key = name.trim().toLowerCase();
    return (aliases.get(key) ?? name).trim().toLowerCase();
  };

  const rows = await d
    .prepare(
      // Pending and rejected claims are on the record and do not score. The
      // archive shows them; the blade does not count them.
      `SELECT lower(person) AS n, act, place, year, category, confidence, attribution, act_date,
              evidence_grade
         FROM ledger_entries
        WHERE review_status IN ('accepted', 'legacy')
        ORDER BY confidence DESC, year DESC`,
    )
    .bind()
    .all();

  const map = new Map<string, LedgerSummary>();
  const cutoff = new Date().getFullYear() - 1;

  for (const r of rows.results ?? []) {
    const key = canonicalKey(String(r.n ?? ""));
    if (!key) continue;
    const conf = Number(r.confidence ?? 0);
    const s =
      map.get(key) ??
      ({
        count: 0,
        avgConfidence: 0,
        maxConfidence: 0,
        recent: 0,
        windowActs: 0,
        evidence: 0,
        newest: null,
        top: [],
      } as LedgerSummary);

    s.count += 1;
    s.avgConfidence += conf;
    s.maxConfidence = Math.max(s.maxConfidence, conf);
    if (Number(r.year ?? 0) >= cutoff) s.recent += 1;
    s.top.push({
      act: String(r.act ?? ""),
      place: String(r.place ?? ""),
      year: Number(r.year ?? 0),
      category: String(r.category ?? ""),
      confidence: conf,
      attribution: r.attribution === null || r.attribution === undefined ? 1 : Number(r.attribution),
      actDate: r.act_date == null ? null : String(r.act_date),
      grade: String(r.evidence_grade ?? ""),
    });
    map.set(key, s);
  }

  for (const s of map.values()) {
    s.avgConfidence = s.count ? s.avgConfidence / s.count : 0;
    // The number the line shows is the record inside the window, not the
    // lifetime total. Computed before `top` is trimmed, from every entry.
    const evidence = evidenceFor(s.top);
    s.windowActs = evidence.acts;
    s.evidence = evidence.score;
    s.newest = evidence.newest
      ? {
          act: evidence.newest.act,
          place: evidence.newest.place ?? "",
          year: evidence.newest.year,
          category: evidence.newest.category ?? "",
          confidence: evidence.newest.confidence,
          date: evidence.newest.date,
        }
      : null;

    // A record is not twelve versions of the same charge. Show the judge the
    // range: the strongest act in each category first, then fill the remaining
    // slots with the highest-confidence leftovers.
    const picked: typeof s.top = [];
    const seen = new Set<string>();
    for (const e of s.top) {
      if (picked.length >= 12) break;
      if (!seen.has(e.category)) {
        picked.push(e);
        seen.add(e.category);
      }
    }
    for (const e of s.top) {
      if (picked.length >= 12) break;
      if (!picked.includes(e)) picked.push(e);
    }
    s.top = picked;
  }
  return map;
}

/** Look up a name's record, falling back to its distinctive tokens. */
export function ledgerSummaryFor(
  summaries: Map<string, LedgerSummary>,
  name: string,
): LedgerSummary | undefined {
  const exact = summaries.get(name.toLowerCase());
  if (exact) return exact;
  const [first, last] = namePair(name);
  if (!first || !last) return undefined;
  let best: LedgerSummary | undefined;
  for (const [key, s] of summaries) {
    if (key.includes(first) && key.includes(last)) {
      if (!best || s.count > best.count) best = s;
    }
  }
  return best;
}

export interface RecentCharge {
  person: string;
  slug: string;
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  /** ISO date when the act text gives one, otherwise null. */
  date: string | null;
  /** When the charge was filed. */
  createdAt: string;
}

export interface ChargeStats {
  total: number;
  last24h: number;
}

/**
 * The newest charge filed for each name.
 *
 * A rail that showed the twelve latest rows would be one person's dossier on a
 * good day. Research files in batches, so the newest row per person is the
 * honest unit: what was just added to whose record.
 */
export async function recentCharges(limit = 10): Promise<RecentCharge[]> {
  const d = await db();
  if (!d) return [];
  const currentYear = new Date().getUTCFullYear();
  const rows = await d
    .prepare(
      `SELECT lower(person) AS key, person, act, place, year, category, confidence, created_at
         FROM ledger_entries
        WHERE year >= ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT 2000`,
    )
    .bind(currentYear - 1)
    .all();

  const now = Date.now();
  const dated: Array<{ at: number; charge: RecentCharge }> = [];
  const undated: Array<{ at: number; charge: RecentCharge }> = [];

  for (const r of rows.results ?? []) {
    const year = Number(r.year ?? 0);
    const act = String(r.act ?? "");
    const stamp = actDate(act, year);
    const createdAt = String(r.created_at ?? "");
    const charge: RecentCharge = {
      person: String(r.person ?? ""),
      slug: slugify(String(r.person ?? "")),
      act,
      place: String(r.place ?? ""),
      year,
      category: String(r.category ?? ""),
      confidence: Number(r.confidence ?? 0),
      date: stamp?.precise ? stamp.at.toISOString().slice(0, 10) : null,
      createdAt,
    };

    if (stamp?.precise) {
      // The rail is ordered by what happened, not by when we filed it, so an
      // act from 2017 cannot sit above one from last week because a batch ran.
      const ageDays = (now - stamp.at.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays <= EVIDENCE_WINDOW_DAYS && ageDays >= -7) {
        dated.push({ at: stamp.at.getTime(), charge });
      }
    } else if (year === currentYear) {
      // A bare year cannot be placed on the calendar. Keep it as a fallback,
      // below everything dated, and never let an older year through.
      undated.push({ at: Date.parse(createdAt) || 0, charge });
    }
  }

  dated.sort((a, b) => b.at - a.at);
  undated.sort((a, b) => b.at - a.at);

  const seen = new Set<string>();
  const out: RecentCharge[] = [];
  for (const item of [...dated, ...undated]) {
    const key = item.charge.person.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.charge);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * How many charges carry a source link.
 *
 * The manifesto claims every charge links to the report it came from. That is
 * a checkable statement, so the manifesto page checks it against the table
 * instead of trusting the prose.
 */
export async function ledgerSourceCoverage(): Promise<{
  total: number;
  withSource: number;
}> {
  const d = await db();
  if (!d) return { total: 0, withSource: 0 };
  try {
    const row = await d
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN sources IS NULL OR sources = '' OR sources = '[]' THEN 0 ELSE 1 END) AS with_source
           FROM ledger_entries`,
      )
      .first<{ total?: number; with_source?: number }>();
    return {
      total: Number(row?.total ?? 0),
      withSource: Number(row?.with_source ?? 0),
    };
  } catch {
    return { total: 0, withSource: 0 };
  }
}

export async function chargeStats(): Promise<ChargeStats> {
  const d = await db();
  if (!d) return { total: 0, last24h: 0 };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const row = await d
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS recent
           FROM ledger_entries`,
      )
      .bind(since)
      .first<{ total?: number; recent?: number }>();
    return { total: Number(row?.total ?? 0), last24h: Number(row?.recent ?? 0) };
  } catch {
    return { total: 0, last24h: 0 };
  }
}
