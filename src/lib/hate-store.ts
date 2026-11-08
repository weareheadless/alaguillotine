import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Figure, HateDimension } from "./hateometer";
import { slugify } from "./slug";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
  all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
};
export type D1 = { prepare: (query: string) => D1Statement };

export async function getDb(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 };
  };
  return context.env?.D1 ?? null;
}

export interface HateRow {
  level: number;
  composite: number;
  dimensions: HateDimension[];
  figures: Figure[];
  sourceHash: string | null;
  computedAt: string;
}

const parse = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export async function readHate(db: D1): Promise<HateRow | null> {
  const row = await db
    .prepare(
      "SELECT level, composite, dimensions, figures, source_hash, computed_at FROM hate_readings WHERE id = ?",
    )
    .bind("current")
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    level: Number(row.level),
    composite: Number(row.composite),
    dimensions: parse<HateDimension[]>(row.dimensions, []),
    figures: parse<Figure[]>(row.figures, []),
    sourceHash: typeof row.source_hash === "string" ? row.source_hash : null,
    computedAt: String(row.computed_at),
  };
}

export async function writeHate(db: D1, row: HateRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO hate_readings (id, level, composite, dimensions, items, figures, source_hash, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         level = excluded.level,
         composite = excluded.composite,
         dimensions = excluded.dimensions,
         items = excluded.items,
         figures = excluded.figures,
         source_hash = excluded.source_hash,
         computed_at = excluded.computed_at`,
    )
    .bind(
      "current",
      row.level,
      row.composite,
      JSON.stringify(row.dimensions),
      JSON.stringify([]),
      JSON.stringify(row.figures),
      row.sourceHash,
      row.computedAt,
    )
    .run();
}

const FIGURE_COLUMNS =
  "name, slug, role, country, reason, score, mentions, rank, prev_rank, added_at, last_seen_at, dropped_at, items, source, source_url, times_chopped, record_bonus";

function rowToFigure(r: Record<string, unknown>): Figure {
  return {
    name: String(r.name),
    role: String(r.role ?? ""),
    country: String(r.country ?? ""),
    score: Number(r.score),
    mentions: Number(r.mentions),
    reason: String(r.reason ?? ""),
    source: String(r.source ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    items: parse<Figure["items"]>(r.items, []),
    rank: Number(r.rank),
    prevRank: r.prev_rank == null ? null : Number(r.prev_rank),
    delta: r.prev_rank == null ? null : Number(r.prev_rank) - Number(r.rank),
    addedAt: String(r.added_at),
    // A chop is a tally, not an exit: nobody is ever off the line.
    droppedAt: null,
    timesChopped: Number(r.times_chopped ?? 0),
    recordBonus: Number(r.record_bonus ?? 0),
  };
}

/** The queue persists across passes: Ada adds people, they stay. */
export async function readQueue(db: D1): Promise<Figure[]> {
  const rows = await db
    .prepare(`SELECT ${FIGURE_COLUMNS} FROM queue_people ORDER BY rank ASC`)
    .all();

  // Rank by the counter as it stands now, not the rank frozen at the last pass:
  // a chop resets the counter, and the line has to move with it. The stored
  // rank becomes the "was", so the arrow still says what changed.
  return (rows.results ?? [])
    .map(rowToFigure)
    .sort((a, b) => b.score - a.score || b.mentions - a.mentions)
    .map((f, i) => {
      const rank = i + 1;
      return {
        ...f,
        prevRank: f.rank,
        rank,
        delta: f.rank - rank,
      };
    });
}

/** One name, with its chop tally and the last time the blade fell. */
export async function getPersonBySlug(slug: string): Promise<Figure | null> {
  const db = await getDb();
  if (!db) return null;

  const row = await db
    .prepare(`SELECT ${FIGURE_COLUMNS} FROM queue_people WHERE slug = ?`)
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!row) return null;

  const figure = rowToFigure(row);

  // The stored rank is from the last research pass; a chop moves the line, so
  // show the rank the name holds right now.
  try {
    const queue = await readQueue(db);
    const live = queue.find((p) => p.name.toLowerCase() === figure.name.toLowerCase());
    if (live) figure.rank = live.rank;
  } catch {
    /* keep the stored rank */
  }

  try {
    const chops = await db
      .prepare(
        "SELECT COUNT(*) AS n, MAX(chopped_at) AS last FROM chop_events WHERE slug = ?",
      )
      .bind(slug)
      .first<Record<string, unknown>>();
    figure.timesChopped = Number(chops?.n ?? figure.timesChopped ?? 0);
    figure.lastChoppedAt = chops?.last == null ? null : String(chops.last);
  } catch {
    figure.lastChoppedAt = null;
  }

  return figure;
}

export async function writeQueue(db: D1, people: Figure[]): Promise<void> {
  for (const p of people) {
    await db
      .prepare(
        `INSERT INTO queue_people (id, name, slug, role, country, reason, score, mentions, rank, prev_rank, added_at, last_seen_at, dropped_at, items, source, source_url, record_bonus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           role = excluded.role,
           country = excluded.country,
           reason = excluded.reason,
           -- A chopped counter climbs back from its reset instead of snapping
           -- to the fresh score. Below 70 the name is still climbing; above it,
           -- Ada's number takes over again.
           score = CASE
             WHEN queue_people.times_chopped > 0 AND queue_people.score < excluded.score
               THEN MIN(excluded.score, queue_people.score + 12)
             ELSE excluded.score
           END,
           mentions = excluded.mentions,
           prev_rank = queue_people.rank,
           rank = excluded.rank,
           last_seen_at = excluded.last_seen_at,
           dropped_at = COALESCE(queue_people.dropped_at, excluded.dropped_at),
           items = excluded.items,
           source = excluded.source,
           source_url = excluded.source_url,
           record_bonus = excluded.record_bonus`,
      )
      .bind(
        slugify(p.name),
        p.name,
        slugify(p.name),
        p.role,
        p.country,
        p.reason,
        p.score,
        p.mentions,
        p.rank,
        p.prevRank,
        p.addedAt ?? new Date().toISOString(),
        new Date().toISOString(),
        p.droppedAt ?? null,
        JSON.stringify(p.items),
        p.source,
        p.sourceUrl,
        p.recordBonus ?? 0,
      )
      .run();
  }
}

/**
 * The drop, and the return.
 *
 * When a counter reaches the threshold the blade falls, the chop is written to
 * the record, and the person goes back into the line with their counter reset.
 * Being chopped is not an ending — it is a tally. The archive remembers; the
 * line keeps going.
 *
 * One chop per name per cooling window: without it, every page load would chop
 * the same person again, because the research pass restores their score. The
 * wall counts executions, not refreshes.
 */
/**
 * The blade hangs, then falls.
 *
 * A name that reaches the threshold is sentenced, not chopped on the spot.
 * Its countdown runs in public; when it reaches zero the blade drops, the head
 * rolls, the counter resets and the next name comes up. One execution per
 * cooling window, so the line moves like a ritual and not like a batch job.
 */
export const SENTENCE_MS = 10 * 60 * 1000;
export const EXECUTION_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export interface Sentence {
  person: string;
  slug: string;
  score: number;
  sentencedAt: string;
  executeAt: string;
}

export interface Execution extends Sentence {
  executedAt: string;
}

const sentenceFrom = (r: Record<string, unknown>): Sentence => ({
  person: String(r.person),
  slug: String(r.slug),
  score: Number(r.score),
  sentencedAt: String(r.sentenced_at),
  executeAt: String(r.execute_at),
});

/** The sentence waiting for its blade, or null. */
export async function readSentence(db: D1): Promise<Sentence | null> {
  try {
    const row = await db
      .prepare(
        "SELECT person, slug, score, sentenced_at, execute_at FROM chop_sentences WHERE executed_at IS NULL ORDER BY execute_at ASC LIMIT 1",
      )
      .first<Record<string, unknown>>();
    return row ? sentenceFrom(row) : null;
  } catch {
    return null;
  }
}

/** The last blade that fell, while the wound is still fresh. */
export async function readLastExecution(
  db: D1,
  withinMs = 30 * 60 * 1000,
): Promise<Execution | null> {
  try {
    const row = await db
      .prepare(
        "SELECT person, slug, score, sentenced_at, execute_at, executed_at FROM chop_sentences WHERE executed_at IS NOT NULL ORDER BY executed_at DESC LIMIT 1",
      )
      .first<Record<string, unknown>>();
    if (!row) return null;
    const at = String(row.executed_at);
    if (Date.now() - Date.parse(at) > withinMs) return null;
    return { ...sentenceFrom(row), executedAt: at };
  } catch {
    return null;
  }
}

/**
 * Sentence the worst name that is eligible, if the line is not already waiting
 * on a blade and the cooling window since the last execution has passed.
 *
 * There is no per-name cooldown: the counter reset to 60 is the brake, and the
 * climb back is the point. A name that returns to the top earns another turn.
 */
export async function ensureSentence(db: D1, threshold: number): Promise<Sentence | null> {
  const pending = await readSentence(db);
  if (pending) return pending;

  const now = Date.now();
  try {
    const last = await db
      .prepare("SELECT MAX(executed_at) AS last FROM chop_sentences WHERE executed_at IS NOT NULL")
      .first<Record<string, unknown>>();
    const lastAt = last?.last ? Date.parse(String(last.last)) : 0;
    if (lastAt && now - lastAt < EXECUTION_COOLDOWN_MS) return null;
  } catch {
    /* table not created yet */
  }

  const top = await db
    .prepare(
      `SELECT slug, name, score FROM queue_people
       WHERE score >= ?
       ORDER BY score DESC, mentions DESC LIMIT 1`,
    )
    .bind(threshold)
    .first<Record<string, unknown>>();
  if (!top) return null;

  const sentence: Sentence = {
    person: String(top.name),
    slug: String(top.slug),
    score: Number(top.score),
    sentencedAt: new Date(now).toISOString(),
    executeAt: new Date(now + SENTENCE_MS).toISOString(),
  };
  await db
    .prepare(
      "INSERT INTO chop_sentences (id, slug, person, score, sentenced_at, execute_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      `${sentence.slug}:${sentence.sentencedAt}`,
      sentence.slug,
      sentence.person,
      sentence.score,
      sentence.sentencedAt,
      sentence.executeAt,
    )
    .run();
  return sentence;
}

/** The blade falls on every sentence whose countdown has run out. */
export async function executeDueSentences(db: D1): Promise<number> {
  const now = new Date().toISOString();
  let rows: { results?: Array<Record<string, unknown>> };
  try {
    rows = await db
      .prepare(
        "SELECT id, slug, person, score FROM chop_sentences WHERE executed_at IS NULL AND execute_at <= ?",
      )
      .bind(now)
      .all();
  } catch {
    return 0;
  }

  const due = rows.results ?? [];
  for (const p of due) {
    const slug = String(p.slug);
    await db
      .prepare(
        "INSERT OR REPLACE INTO chop_events (id, person, slug, score, chopped_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(`${slug}:${now}`, String(p.person), slug, Number(p.score), now)
      .run();
    await db
      .prepare(
        "UPDATE queue_people SET times_chopped = times_chopped + 1, score = ?, dropped_at = NULL WHERE slug = ?",
      )
      .bind(Math.max(50, Math.round(Number(p.score) * 0.6)), slug)
      .run();
    await db
      .prepare("UPDATE chop_sentences SET executed_at = ? WHERE id = ?")
      .bind(now, String(p.id))
      .run();
  }
  return due.length;
}

export interface ChopRow {
  person: string;
  slug: string;
  count: number;
  lastAt: string;
}

export async function listChops(db: D1): Promise<ChopRow[]> {
  const rows = await db
    .prepare(
      "SELECT person, slug, COUNT(*) AS n, MAX(chopped_at) AS last FROM chop_events GROUP BY slug ORDER BY n DESC, last DESC",
    )
    .all();
  return (rows.results ?? []).map((r) => ({
    person: String(r.person),
    slug: String(r.slug),
    count: Number(r.n),
    lastAt: String(r.last),
  }));
}
