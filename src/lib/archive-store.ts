import { getCloudflareContext } from "@opennextjs/cloudflare";

type Stmt = {
  bind: (...v: unknown[]) => Stmt;
  run: () => Promise<unknown>;
  all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
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
  const tokens = nameTokens(name);
  let total = 0;
  for (const r of rows) {
    const p = r.person.toLowerCase();
    if (p === lower || tokens.some((t) => p.includes(t))) total += r.count;
  }
  return total;
}

export async function getLedgerFor(name: string): Promise<LedgerEntry[]> {
  const d = await db();
  if (!d) return [];
  const tokens = nameTokens(name);
  const where = [
    "lower(person) = lower(?)",
    ...tokens.map(() => "lower(person) LIKE ?"),
  ].join(" OR ");
  const rows = await d
    .prepare(
      `SELECT act, place, year, category, confidence, sources FROM ledger_entries WHERE ${where} ORDER BY confidence DESC, year DESC LIMIT 80`,
    )
    .bind(name, ...tokens.map((t) => `%${t}%`))
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
 * The record, summarised for the scorer.
 *
 * A person's score should not forget three years of documented acts because
 * this week's feed was quiet. The summary is what the research pass sees, and
 * the bonus is what the queue adds back on top of Ada's reading.
 */
export interface LedgerSummary {
  count: number;
  avgConfidence: number;
  maxConfidence: number;
  recent: number;
  top: Array<{
    act: string;
    place: string;
    year: number;
    category: string;
    confidence: number;
  }>;
}

export async function readLedgerSummaries(): Promise<Map<string, LedgerSummary>> {
  const d = await db();
  if (!d) return new Map();
  const rows = await d
    .prepare(
      "SELECT lower(person) AS n, act, place, year, category, confidence FROM ledger_entries ORDER BY confidence DESC, year DESC",
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
      ({ count: 0, avgConfidence: 0, maxConfidence: 0, recent: 0, top: [] } as LedgerSummary);

    s.count += 1;
    s.avgConfidence += conf;
    s.maxConfidence = Math.max(s.maxConfidence, conf);
    if (Number(r.year ?? 0) >= cutoff) s.recent += 1;
    if (s.top.length < 12) {
      s.top.push({
        act: String(r.act ?? ""),
        place: String(r.place ?? ""),
        year: Number(r.year ?? 0),
        category: String(r.category ?? ""),
        confidence: conf,
      });
    }
    map.set(key, s);
  }

  for (const s of map.values()) {
    s.avgConfidence = s.count ? s.avgConfidence / s.count : 0;
  }
  return map;
}

/**
 * The record bonus.
 *
 * A small logarithmic nudge, capped at 5, plus a floor for a substantial
 * record so a quiet week cannot erase it. The judge sees the record itself
 * (count, recency, top acts); this only breaks ties in its favour.
 */
export function recordAdjustment(s: LedgerSummary | undefined): { bonus: number; floor: number } {
  if (!s || s.count === 0) return { bonus: 0, floor: 0 };
  // The judge now sees the size of the record (charges, recent, top acts) and
  // is told to weigh it. The bonus is only a nudge, so arithmetic cannot turn
  // a queue of high-80s judgments into a wall of 100s.
  const bonus = Math.min(
    5,
    Math.round((2 * Math.log10(1 + s.count) + 0.01 * s.avgConfidence) * 10) / 10,
  );
  const floor =
    s.count >= 5
      ? Math.min(70, Math.round((28 + 2.2 * s.count + 0.1 * s.avgConfidence) * 10) / 10)
      : 0;
  return { bonus, floor };
}

/** Look up a name's record, falling back to its distinctive tokens. */
export function ledgerSummaryFor(
  summaries: Map<string, LedgerSummary>,
  name: string,
): LedgerSummary | undefined {
  const exact = summaries.get(name.toLowerCase());
  if (exact) return exact;
  const tokens = nameTokens(name);
  let best: LedgerSummary | undefined;
  for (const [key, s] of summaries) {
    if (tokens.some((t) => key.includes(t))) {
      if (!best || s.count > best.count) best = s;
    }
  }
  return best;
}
