import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Figure, HateDimension } from "./hateometer";

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

/** The queue persists across passes: Ada adds people, they stay. */
export async function readQueue(db: D1): Promise<Figure[]> {
  const rows = await db
    .prepare(
      "SELECT name, role, country, reason, score, mentions, rank, prev_rank, added_at, last_seen_at, dropped_at, items, source, source_url FROM queue_people ORDER BY rank ASC",
    )
    .all();
  return (rows.results ?? []).map((r) => ({
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
    droppedAt: r.dropped_at == null ? null : String(r.dropped_at),
  }));
}

export async function writeQueue(db: D1, people: Figure[]): Promise<void> {
  for (const p of people) {
    await db
      .prepare(
        `INSERT INTO queue_people (id, name, slug, role, country, reason, score, mentions, rank, prev_rank, added_at, last_seen_at, dropped_at, items, source, source_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           role = excluded.role,
           country = excluded.country,
           reason = excluded.reason,
           score = excluded.score,
           mentions = excluded.mentions,
           prev_rank = queue_people.rank,
           rank = excluded.rank,
           last_seen_at = excluded.last_seen_at,
           dropped_at = COALESCE(queue_people.dropped_at, excluded.dropped_at),
           items = excluded.items,
           source = excluded.source,
           source_url = excluded.source_url`,
      )
      .bind(
        p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        p.name,
        p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
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
      )
      .run();
  }
}

/**
 * The drop.
 *
 * A counter at or above the threshold means the blade has fallen: it is written
 * once and never cleared, so a person who was dropped stays dropped even if the
 * news moves on.
 */
export async function evaluateDrops(db: D1, threshold: number): Promise<number> {
  const result = (await db
    .prepare(
      "UPDATE queue_people SET dropped_at = ? WHERE dropped_at IS NULL AND score >= ?",
    )
    .bind(new Date().toISOString(), threshold)
    .run()) as { meta?: { changes?: number } };
  return result?.meta?.changes ?? 0;
}

export async function getPersonBySlug(slug: string): Promise<Figure | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db
    .prepare(
      "SELECT name, role, country, reason, score, mentions, rank, prev_rank, added_at, dropped_at, items, source, source_url FROM queue_people WHERE slug = ?",
    )
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!r) return null;
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
    delta: null,
    addedAt: String(r.added_at),
    droppedAt: r.dropped_at == null ? null : String(r.dropped_at),
  };
}
