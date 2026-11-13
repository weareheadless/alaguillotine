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
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  sources: string[];
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
      `SELECT act, place, year, category, confidence, sources, attribution FROM ledger_entries WHERE ${where} ORDER BY confidence DESC, year DESC LIMIT 80`,
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
      act: String(r.act ?? ""),
      place: String(r.place ?? ""),
      year: Number(r.year ?? 0),
      category: String(r.category ?? ""),
      confidence: Number(r.confidence ?? 0),
      sources,
    };
  });
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
  }>;
}

export async function readLedgerSummaries(): Promise<Map<string, LedgerSummary>> {
  const d = await db();
  if (!d) return new Map();
  const rows = await d
    .prepare(
      "SELECT lower(person) AS n, act, place, year, category, confidence, attribution FROM ledger_entries ORDER BY confidence DESC, year DESC",
    )
    .bind()
    .all();

  const map = new Map<string, LedgerSummary>();
  const cutoff = new Date().getFullYear() - 1;

  for (const r of rows.results ?? []) {
    const key = String(r.n ?? "");
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
