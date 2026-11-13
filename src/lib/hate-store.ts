import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Figure, HateDimension } from "./hateometer";
import { slugify } from "./slug";
import { ledgerSummaryFor, readLedgerSummaries } from "./archive-store";
import { COOLDOWN_DAYS, SENTENCE_BAND } from "./evidence";
import { sentenceSlot } from "./schedule";

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

  // The page has to show the same window the number is scored on, or it will
  // say "no open acts" under a score the ledger produced.
  try {
    const summaries = await readLedgerSummaries();
    const summary = ledgerSummaryFor(summaries, figure.name);
    figure.windowActs = summary?.windowActs ?? 0;
    figure.latestAct = summary?.newest ?? null;
    figure.topCharges = summary?.top ?? [];
  } catch {
    /* the row still renders without the receipt */
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
           -- The score is the ledger inside the window. Being chopped does not
           -- reset it and does not add anything: the record did not change, so
           -- the number must not either. A cooldown keeps the blade moving.
           score = excluded.score,
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
 * The blade hangs, then falls on schedule.
 *
 * A name that reaches the threshold is sentenced during the half hour before a
 * public execution slot (09:00, 13:00, 17:00 or 21:00 UTC). Its countdown runs
 * in public; when it reaches zero the blade drops, the head rolls, the counter
 * resets and the next name waits for the next hour. One execution per slot, so
 * the line moves like a ritual and not like a batch job.
 */

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
 * on a blade.
 *
 * Two gates, both about proof rather than arithmetic:
 *
 * - the name must be in the sentence band, the worst by evidence in the line.
 *   There is no absolute threshold to cross; a record is not a verdict.
 * - it must have waited out the cooldown since its last chop, so the blade
 *   moves through the worst names instead of returning to the same one.
 *
 * A name with no act inside the evidence window scores zero and can never be
 * sentenced. That is the proof gate: no recent record, no blade.
 */
export async function ensureSentence(
  db: D1,
  readingAt?: string | null,
): Promise<Sentence | null> {
  const pending = await readSentence(db);
  if (pending) return pending;

  const now = Date.now();
  const slot = sentenceSlot(now, readingAt);
  if (slot == null) return null;

  // One name per appointment. The next name in the band waits for the next
  // public hour, which is at most four hours away — long enough for the blade
  // to be an event, short enough that the queue does not become a week.
  //
  // The band is the top of the line, so the page and the block agree: what a
  // reader sees at the top is what the blade can take.
  const cooldownFrom = new Date(
    now - COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const top = await db
    .prepare(
      `SELECT slug, name, score FROM queue_people
       WHERE score > 0
         AND slug NOT IN (
           SELECT slug FROM chop_events WHERE chopped_at > ?
         )
         AND slug IN (
           SELECT slug FROM queue_people
           WHERE score > 0
           ORDER BY score DESC, mentions DESC
           LIMIT ?
         )
       ORDER BY score DESC, mentions DESC LIMIT 1`,
    )
    .bind(cooldownFrom, SENTENCE_BAND)
    .first<Record<string, unknown>>();
  if (!top) return null;

  const sentencedAt = new Date(now).toISOString();
  const slotIso = new Date(slot).toISOString();
  const slug = String(top.slug);
  // Deterministic per person per slot: two simultaneous page loads cannot put
  // the same name on the block twice.
  await db
    .prepare(
      "INSERT OR IGNORE INTO chop_sentences (id, slug, person, score, sentenced_at, execute_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      `${slug}:${slotIso}`,
      slug,
      String(top.name),
      Number(top.score),
      sentencedAt,
      slotIso,
    )
    .run();

  return readSentence(db);
}

/**
 * The blade falls on every sentence whose countdown has run out.
 *
 * Claiming the sentence is the lock. The tick and a page load can both see the
 * same due row; only the call whose conditional update changes a row goes on to
 * write the chop and raise the tally, so a blade that falls once is counted
 * once. The event id is the sentence id, so a retry cannot add a second cross.
 */
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
  let executed = 0;
  for (const p of due) {
    const id = String(p.id);
    const slug = String(p.slug);
    const claim = (await db
      .prepare(
        "UPDATE chop_sentences SET executed_at = ? WHERE id = ? AND executed_at IS NULL",
      )
      .bind(now, id)
      .run()) as { meta?: { changes?: number } } | undefined;
    if (Number(claim?.meta?.changes ?? 0) !== 1) continue;

    await db
      .prepare(
        "INSERT OR REPLACE INTO chop_events (id, person, slug, score, chopped_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, String(p.person), slug, Number(p.score), now)
      .run();
    // The chop is a tally, not a reset. The record that put the name here has
    // not changed; the cooldown is what keeps the blade moving.
    await db
      .prepare(
        "UPDATE queue_people SET times_chopped = times_chopped + 1, dropped_at = NULL WHERE slug = ?",
      )
      .bind(slug)
      .run();
    executed += 1;
  }
  return executed;
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
