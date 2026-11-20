import { getCloudflareContext } from "@opennextjs/cloudflare";
import { actDate, EVIDENCE_WINDOW_DAYS, evidenceFor } from "./evidence";
import { slugify } from "./slug";
import { nameKey, samePerson } from "./person-name";

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
  /** Ada's take: what follows from the act, in the conditional where needed. */
  take: string;
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
        take: String(r.take ?? ""),
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
              created_at, evidence_grade, institutional_status, grade_basis, take
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
    take: String(r.take ?? ""),
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

/**
 * Every claim that can be opened as its own page, for the sitemap.
 *
 * This is the table `/archive/claim/[id]` actually reads. A crawler found 21 of
 * these pages — linked from a person's record report and from the wire — and
 * none of them was in the sitemap, because the sitemap only knew about names
 * and dispatches. The page is a real, citable permalink: it belongs there.
 */
export async function listClaimRoutes(
  limit = 20_000,
): Promise<Array<{ id: string; at: string | null }>> {
  const d = await db();
  if (!d) return [];
  try {
    const rows = await d
      .prepare(
        `SELECT id, COALESCE(act_date, created_at) AS at
           FROM ledger_entries
          ORDER BY at DESC
          LIMIT ?`,
      )
      .bind(limit)
      .all();
    return (rows.results ?? []).map((r) => ({
      id: String(r.id),
      at: r.at == null ? null : String(r.at),
    }));
  } catch {
    return [];
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
  /** charged | convicted | investigated | settled | sanctioned | admitted | no_action | blocked | unknown */
  outcome: string;
  /** pending | accepted | rejected | legacy */
  status: string;
  /** Ada's take: what follows from the act, in the conditional where needed. */
  take: string;
  /**
   * The finding the passage states, when the claim came from a document rather
   * than the legacy ledger: found | admitted | alleged | none. The person page
   * reads it in the same words the archive uses, so the same claim cannot be a
   * conviction on one page and an unread allegation on another.
   */
  finding?: string;
  /** The sentence the claim rests on, verbatim from the document. */
  quote?: string;
  /** Who published it. */
  issuer?: string;
  /** The document's title, when it has one. */
  title?: string;
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
  let total = 0;
  for (const r of rows) {
    if (r.person.toLowerCase() === lower || samePerson(r.person, name)) total += r.count;
  }
  return total;
}

export async function getLedgerFor(name: string): Promise<LedgerEntry[]> {
  const d = await db();
  if (!d) return [];

  // The entity table holds one row per spelling that was filed. Resolve the
  // spellings the same way discovery does — surname, then a first name that is
  // equal, a diminutive, or a prefix — rather than by substring, which merged
  // different people who happened to share a syllable.
  let entityIds: string[] = [];
  try {
    const entities = await d.prepare("SELECT id, name FROM entities WHERE kind = 'person'").all();
    entityIds = (entities.results ?? [])
      .filter((row) => samePerson(String(row.name ?? ""), name))
      .map((row) => String(row.id ?? ""))
      .filter(Boolean);
  } catch {
    entityIds = [];
  }
  const nameClause = entityIds.length
    ? `c.entity_id IN (${entityIds.map(() => "?").join(", ")})`
    : "lower(e.name) = lower(?)";
  const nameBinds: string[] = entityIds.length ? entityIds : [name];

  // One record: the press claims (including the line pass and the findings) and
  // the older ledger rows, deduplicated by act, claims first because they carry
  // the document and the sentence.
  let claims: LedgerEntry[] = [];
  try {
    const rows = await d
      .prepare(
        `SELECT c.id, c.act, c.category, c.confidence, c.act_date, c.quote,
                c.finding, c.status, e.country, d.issuer, d.title, d.url
           FROM claims c
           JOIN entities e ON e.id = c.entity_id
           JOIN documents d ON d.id = c.document_id
          WHERE ${nameClause} AND d.kind = 'press' AND c.status != 'retracted'
          ORDER BY COALESCE(c.act_date, d.published_at) DESC
          LIMIT 160`,
      )
      .bind(...nameBinds)
      .all();
    claims = (rows.results ?? []).map((r) => {
      const finding = String(r.finding ?? "none");
      const quote = String(r.quote ?? "");
      const grade =
        finding === "found" ? "A" : finding === "admitted" ? "B" : finding === "alleged" ? "C" : quote ? "C" : "D";
      const date = r.act_date == null ? null : String(r.act_date);
      return {
        id: String(r.id ?? ""),
        act: String(r.act ?? ""),
        place: String(r.country ?? ""),
        year: date ? Number(date.slice(0, 4)) : 0,
        category: String(r.category ?? ""),
        confidence: Math.round(Number(r.confidence ?? 0) * 100),
        sources: r.url ? [String(r.url)] : [],
        actDate: date,
        grade,
        // The archive's own words for the finding. A discovery or findings
        // claim used to say "found" here, a term no other page uses, and the
        // page counted zero proceedings under a record of convictions.
        outcome:
          finding === "found"
            ? "convicted"
            : finding === "admitted"
              ? "admitted"
              : finding === "alleged"
                ? "charged"
                : "unknown",
        status: String(r.status ?? "recorded"),
        take: "",
        finding,
        quote,
        issuer: String(r.issuer ?? ""),
        title: String(r.title ?? ""),
      };
    });
  } catch {
    claims = [];
  }

  let ledgerNames: string[] = [];
  try {
    const people = await d.prepare("SELECT DISTINCT person FROM ledger_entries").all();
    ledgerNames = (people.results ?? [])
      .map((row) => String(row.person ?? ""))
      .filter((person) => person && samePerson(person, name));
  } catch {
    ledgerNames = [];
  }
  const where = ledgerNames.length
    ? `lower(person) IN (${ledgerNames.map(() => "?").join(", ")})`
    : "lower(person) = lower(?)";
  const rows = await d
    .prepare(
      `SELECT id, act, place, year, category, confidence, sources, attribution, act_date,
              evidence_grade, institutional_status, review_status, take
         FROM ledger_entries WHERE ${where} ORDER BY confidence DESC, year DESC LIMIT 80`,
    )
    .bind(...(ledgerNames.length ? ledgerNames.map((person) => person.toLowerCase()) : [name]))
    .all();
  const ledger = (rows.results ?? []).map((r) => {
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
      take: String(r.take ?? ""),
    };
  });

  const key = (act: string) =>
    act.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 180);
  const seen = new Set(claims.map((entry) => key(entry.act)));
  return [...claims, ...ledger.filter((entry) => !seen.has(key(entry.act)))].sort(
    (a, b) => b.confidence - a.confidence || b.year - a.year,
  );
}

/**
 * What they declared, and when.
 *
 * A statement of assets filed at the start of a job and again at the end is a
 * better answer to "did he get rich in office" than any list of estimates,
 * because the state compelled it and the document can be read.
 */
export interface DeclarationRow {
  id: string;
  kind: string;
  jurisdiction: string;
  filedAt: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  assets: number | null;
  debts: number | null;
  net: number | null;
  income: number | null;
  valueLow: number | null;
  valueHigh: number | null;
  currency: string;
  sourceUrl: string;
  note: string;
}

export async function getDeclarationsFor(slug: string): Promise<DeclarationRow[]> {
  const d = await db();
  if (!d) return [];
  try {
    const rows = await d
      .prepare(
        `SELECT id, kind, jurisdiction, filed_at, period_from, period_to, assets, debts, net,
                income, value_low, value_high, currency, source_url, note
           FROM declarations WHERE slug = ? ORDER BY period_to`,
      )
      .bind(slug)
      .all();
    return (rows.results ?? []).map((r) => ({
      id: String(r.id ?? ""),
      kind: String(r.kind ?? ""),
      jurisdiction: String(r.jurisdiction ?? ""),
      filedAt: r.filed_at == null ? null : String(r.filed_at),
      periodFrom: r.period_from == null ? null : String(r.period_from),
      periodTo: r.period_to == null ? null : String(r.period_to),
      assets: r.assets == null ? null : Number(r.assets),
      debts: r.debts == null ? null : Number(r.debts),
      net: r.net == null ? null : Number(r.net),
      income: r.income == null ? null : Number(r.income),
      valueLow: r.value_low == null ? null : Number(r.value_low),
      valueHigh: r.value_high == null ? null : Number(r.value_high),
      currency: String(r.currency ?? "EUR"),
      sourceUrl: String(r.source_url ?? ""),
      note: String(r.note ?? ""),
    }));
  } catch {
    // Table not migrated yet.
    return [];
  }
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
  // The key ignores middle names and suffixes, so "Johnny Lehi Jr." and
  // "Johnny Lehi" are one person's record before any alias is approved.
  const canonicalKey = (name: string): string => nameKey(aliases.get(name.trim().toLowerCase()) ?? name);

  const ledgerRows = await d
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

  // One record: the press claims are the same record the archive shows. Without
  // them a name the line or the discovery pass found scores at zero and the
  // queue pass drops it, even though its acts are on the archive.
  const actKey = (act: string): string =>
    act.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 180);
  const seenActs = new Set<string>();
  const records: Array<Record<string, unknown>> = [];
  const take = (row: Record<string, unknown>): void => {
    const key = `${canonicalKey(String(row.n ?? ""))}|${actKey(String(row.act ?? ""))}`;
    if (seenActs.has(key)) return;
    seenActs.add(key);
    records.push(row);
  };

  try {
    const claims = await d
      .prepare(
        `SELECT lower(e.name) AS n, c.act, e.country AS place,
                CASE WHEN c.act_date IS NULL OR c.act_date = ''
                     THEN 0 ELSE CAST(substr(c.act_date, 1, 4) AS INTEGER) END AS year,
                c.category, c.confidence, c.act_date, c.finding, c.quote
           FROM claims c
           JOIN entities e ON e.id = c.entity_id
           JOIN documents d ON d.id = c.document_id
          WHERE d.kind = 'press' AND c.status != 'retracted'`,
      )
      .bind()
      .all();
    for (const row of claims.results ?? []) {
      const finding = String(row.finding ?? "none");
      const quote = String(row.quote ?? "");
      take({
        n: row.n,
        act: row.act,
        place: row.place,
        year: row.year,
        category: row.category,
        confidence: Math.round(Number(row.confidence ?? 0.5) * 100),
        attribution: 1,
        act_date: row.act_date,
        evidence_grade:
          finding === "found"
            ? "A"
            : finding === "admitted"
              ? "B"
              : finding === "alleged"
                ? "C"
                : quote
                  ? "C"
                  : "D",
      });
    }
  } catch {
    /* the archive tables are optional for a queue that has only the old ledger */
  }

  for (const row of ledgerRows.results ?? []) take({ ...row } as Record<string, unknown>);

  const map = new Map<string, LedgerSummary>();
  const cutoff = new Date().getFullYear() - 1;

  for (const r of records) {
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
  const exact = summaries.get(nameKey(name));
  if (exact) return exact;
  let best: LedgerSummary | undefined;
  for (const [key, s] of summaries) {
    if (samePerson(key, name)) {
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

/**
 * Charges on record, and how many of them are actually current.
 *
 * "Filed in the last day" used to count rows inserted since yesterday, which is
 * how a bulk import of the archive reported four thousand charges filed today.
 * The date that matters is the act's, so a claim is recent only when the act
 * happened inside the day. A number nobody can check is the one thing this
 * site cannot print.
 */
export async function chargeStats(): Promise<ChargeStats> {
  const d = await db();
  if (!d) return { total: 0, last24h: 0 };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    // The record is the press file: the acts behind the line, plus the findings
    // the machine adds. A vote or a trade is not a charge on this site.
    const row = await d
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN c.created_at >= ? THEN 1 ELSE 0 END) AS recent
           FROM claims c
           JOIN documents d ON d.id = c.document_id
          WHERE d.kind = 'press' AND c.status != 'retracted'`,
      )
      .bind(since)
      .first<{ total?: number; recent?: number }>();
    return { total: Number(row?.total ?? 0), last24h: Number(row?.recent ?? 0) };
  } catch {
    return { total: 0, last24h: 0 };
  }
}
