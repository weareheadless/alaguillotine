import type { D1 } from "./clock-store";
import { fetchLemmyFeed } from "./lemmy";

/**
 * THE FEED — the doom scroll.
 *
 * The wire is infinite; the record is not. Every card is a row in one table so
 * the page can order, page and dedupe it with a single query:
 *
 *   wire    a post from a federated community, with Ada's one-line charge
 *   record  a dispatch or a receipt from the site's own record
 *   ad      the fund, clearly labelled, never ranked
 *
 * `first_seen_at` is when the feed met the item. Ranking uses that, not the
 * article's publication date, because a feed is a record of what it showed
 * you, not a newspaper.
 */

export type FeedKind = "wire" | "charge" | "record" | "ad";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  url: string;
  title: string;
  gloss: string;
  source: string;
  community: string;
  category: string;
  score: number;
  comments: number;
  severity: number;
  cluster: string;
  clusterSize: number;
  publishedAt: string;
  firstSeenAt: string;
  heat: number;
}

interface Row {
  id?: string;
  kind?: string;
  url?: string;
  title?: string;
  gloss?: string;
  source?: string;
  community?: string;
  category?: string;
  score?: number;
  comments?: number;
  severity?: number;
  cluster?: string;
  cluster_size?: number;
  published_at?: string;
  first_seen_at?: string;
  heat?: number;
  n?: number;
}

/**
 * The ranking, in SQL and in public: severity × 10 + score + 200 ÷ hours since
 * we saw it. No profile of the reader, no dwell time, no personalisation.
 */
const HEAT =
  "(severity * 10 + MIN(score, 200) + 200.0 / (1.0 + (julianday('now') - julianday(first_seen_at)) * 24.0))";

const SELECT = `SELECT id, kind, url, title, gloss, source, community, category,
  score, comments, severity, cluster, cluster_size, published_at, first_seen_at,
  ${HEAT} AS heat
FROM feed_items`;

export function toFeedItem(row: Row): FeedItem {
  return {
    id: String(row.id ?? ""),
    kind: (row.kind as FeedKind) ?? "wire",
    url: String(row.url ?? ""),
    title: String(row.title ?? ""),
    gloss: String(row.gloss ?? ""),
    source: String(row.source ?? ""),
    community: String(row.community ?? ""),
    category: String(row.category ?? "wire"),
    score: Number(row.score ?? 0),
    comments: Number(row.comments ?? 0),
    severity: Number(row.severity ?? 0),
    cluster: String(row.cluster ?? ""),
    clusterSize: Number(row.cluster_size ?? 1),
    publishedAt: String(row.published_at ?? ""),
    firstSeenAt: String(row.first_seen_at ?? ""),
    heat: Number(row.heat ?? 0),
  };
}

export async function readFeedPage(
  db: D1,
  offset = 0,
  limit = 12,
): Promise<{ items: FeedItem[]; total: number }> {
  // One row per story: duplicates point at their cluster's representative.
  const rows = await db
    .prepare(
      `${SELECT}
       WHERE cluster = id AND (kind != 'wire' OR gloss != '')
       ORDER BY heat DESC, first_seen_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(limit, offset)
    .all();
  const count = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM feed_items WHERE cluster = id AND (kind != 'wire' OR gloss != '')",
    )
    .first<{ n?: number }>();
  return {
    items: (rows.results ?? []).map((r) => toFeedItem(r as Row)),
    total: Number(count?.n ?? 0),
  };
}

export async function feedStats(db: D1): Promise<{
  items: number;
  wire: number;
  discarded: number;
  names: number;
  receipts: number;
  dispatches: number;
}> {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM feed_items) AS items,
        (SELECT COUNT(*) FROM feed_items WHERE kind = 'wire') AS wire,
        (SELECT COUNT(*) FROM feed_items WHERE kind = 'wire' AND gloss = '') AS discarded,
        (SELECT COUNT(*) FROM queue_people) AS names,
        (SELECT COUNT(*) FROM person_numbers) AS receipts,
        (SELECT COUNT(*) FROM dispatches) AS dispatches`,
    )
    .first<Record<string, number>>();
  return {
    items: Number(row?.items ?? 0),
    wire: Number(row?.wire ?? 0),
    discarded: Number(row?.discarded ?? 0),
    names: Number(row?.names ?? 0),
    receipts: Number(row?.receipts ?? 0),
    dispatches: Number(row?.dispatches ?? 0),
  };
}

async function hashId(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "are",
  "was", "were", "will", "would", "into", "over", "after", "before", "about",
  "their", "they", "them", "than", "then", "says", "said", "new", "now",
  "you", "your", "his", "her", "its", "our", "out", "not", "but", "who",
  "what", "when", "where", "why", "how", "all", "can", "could", "may",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
}

/** One story can arrive from twelve communities. The feed shows it once. */
function clusterWire(
  rows: Array<{ id: string; title: string }>,
): Map<string, { rep: string; size: number }> {
  const groups: Array<{ rep: string; words: Set<string>; ids: string[] }> = [];
  for (const row of rows) {
    const words = new Set(tokens(row.title));
    let joined = false;
    for (const group of groups) {
      let shared = 0;
      for (const word of words) if (group.words.has(word)) shared += 1;
      const smaller = Math.min(words.size, group.words.size) || 1;
      if (shared >= 2 && shared / smaller >= 0.5) {
        group.ids.push(row.id);
        joined = true;
        break;
      }
    }
    if (!joined) groups.push({ rep: row.id, words, ids: [row.id] });
  }
  const result = new Map<string, { rep: string; size: number }>();
  for (const group of groups) {
    for (const id of group.ids) {
      result.set(id, { rep: group.rep, size: group.ids.length });
    }
  }
  return result;
}

const CATEGORY_BY_KIND: Record<string, string> = {
  wealth: "extraction",
  profit: "extraction",
  fines: "extraction",
  tax: "extraction",
  deaths: "cost",
  displacement: "cost",
  layoffs: "cost",
  workers: "cost",
  emissions: "cost",
  public_money: "cost",
  donations: "cost",
  other: "extraction",
};

export interface RefreshResult {
  fetched: number;
  added: number;
  records: number;
  clustered: number;
  glossed: number;
  pruned: number;
}

/** Pull the wire, file the record, cluster the repeats, expire the old. */
export async function refreshFeed(db: D1): Promise<RefreshResult> {
  const now = new Date().toISOString();
  const result: RefreshResult = {
    fetched: 0,
    added: 0,
    records: 0,
    clustered: 0,
    glossed: 0,
    pruned: 0,
  };

  let added = 0;
  try {
    const posts = await fetchLemmyFeed(18);
    result.fetched = posts.length;
    for (const post of posts) {
      const id = await hashId(post.url);
      const published = post.date || now;
      const res = (await db
        .prepare(
          `INSERT OR IGNORE INTO feed_items
            (id, kind, url, title, gloss, source, community, category, score, comments,
             severity, cluster, cluster_size, published_at, first_seen_at)
           VALUES (?, 'wire', ?, ?, '', ?, ?, 'wire', ?, ?, 0, ?, 1, ?, ?)`,
        )
        .bind(
          id,
          post.url,
          post.title.slice(0, 220),
          post.site,
          post.topic,
          post.score,
          post.comments,
          id,
          published,
          now,
        )
        .run()) as { meta?: { changes?: number } };
      if ((res.meta?.changes ?? 0) > 0) added += 1;
    }
  } catch (error) {
    console.error("feed_wire_failed", error);
  }
  result.added = added;

  // ─── The record: dispatches and receipts are posts too ──────────────────
  try {
    const dispatches = await db
      .prepare(
        `SELECT slug, title, dek, category, published_at FROM dispatches
         ORDER BY published_at DESC LIMIT 8`,
      )
      .all();
    for (const row of dispatches.results ?? []) {
      const slug = String(row.slug ?? "");
      const title = String(row.title ?? "");
      if (!slug || !title) continue;
      const id = await hashId(`dispatch:${slug}`);
      const res = (await db
        .prepare(
          `INSERT OR IGNORE INTO feed_items
            (id, kind, url, title, gloss, source, community, category, score, comments,
             severity, cluster, cluster_size, published_at, first_seen_at)
           VALUES (?, 'record', ?, ?, ?, 'dispatch', '', ?, 0, 0, 100, ?, 1, ?, ?)`,
        )
        .bind(
          id,
          `/blog/${slug}`,
          title.slice(0, 220),
          String(row.dek ?? "").slice(0, 240),
          String(row.category ?? "extraction"),
          id,
          String(row.published_at ?? now),
          now,
        )
        .run()) as { meta?: { changes?: number } };
      if ((res.meta?.changes ?? 0) > 0) result.records += 1;
    }
  } catch (error) {
    console.error("feed_dispatches_failed", error);
  }

  try {
    const receipts = await db
      .prepare(
        `SELECT n.slug, q.name, n.label, n.display, n.kind, n.checked_at
         FROM person_numbers n
         JOIN queue_people q ON q.slug = n.slug
         ORDER BY n.checked_at DESC LIMIT 60`,
      )
      .all();
    // One receipt per name. A feed that shows three Duterte rows in a row is
    // a database, not a feed.
    const seen = new Set<string>();
    const chosen: Array<Record<string, unknown>> = [];
    for (const row of receipts.results ?? []) {
      const slug = String(row.slug ?? "");
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      chosen.push(row);
      if (chosen.length >= 8) break;
    }
    for (const row of chosen) {
      const slug = String(row.slug ?? "");
      const display = String(row.display ?? "");
      if (!slug || !display) continue;
      const id = await hashId(`receipt:${slug}:${row.label}:${display}`);
      const res = (await db
        .prepare(
          `INSERT OR IGNORE INTO feed_items
            (id, kind, url, title, gloss, source, community, category, score, comments,
             severity, cluster, cluster_size, published_at, first_seen_at)
           VALUES (?, 'record', ?, ?, ?, 'receipt', '', ?, 0, 0, 100, ?, 1, ?, ?)`,
        )
        .bind(
          id,
          `/person/${slug}`,
          `${String(row.name ?? "A name")}: ${display}`.slice(0, 220),
          String(row.label ?? "").slice(0, 240),
          CATEGORY_BY_KIND[String(row.kind ?? "")] ?? "extraction",
          id,
          String(row.checked_at ?? now),
          now,
        )
        .run()) as { meta?: { changes?: number } };
      if ((res.meta?.changes ?? 0) > 0) result.records += 1;
    }
  } catch (error) {
    console.error("feed_receipts_failed", error);
  }

  // ─── Cluster the repeats ────────────────────────────────────────────────
  try {
    const rows = await db
      .prepare(
        `SELECT id, title, cluster, cluster_size FROM feed_items
         WHERE kind = 'wire' AND julianday(first_seen_at) > julianday('now', '-3 days')`,
      )
      .all();
    const items = (rows.results ?? []).map((row) => ({
      id: String(row.id ?? ""),
      title: String(row.title ?? ""),
      cluster: String(row.cluster ?? ""),
      size: Number(row.cluster_size ?? 1),
    }));
    const clusters = clusterWire(items);
    for (const item of items) {
      const next = clusters.get(item.id);
      if (!next) continue;
      if (next.rep === item.cluster && next.size === item.size) continue;
      await db
        .prepare(
          "UPDATE feed_items SET cluster = ?, cluster_size = ? WHERE id = ?",
        )
        .bind(next.rep, next.size, item.id)
        .run();
      result.clustered += 1;
    }
  } catch (error) {
    console.error("feed_cluster_failed", error);
  }

  // ─── Expire the wire; the record stays ──────────────────────────────────
  try {
    const res = (await db
      .prepare(
        `DELETE FROM feed_items
         WHERE kind = 'wire' AND julianday(first_seen_at) < julianday('now', '-3 days')`,
      )
      .run()) as { meta?: { changes?: number } };
    result.pruned = res.meta?.changes ?? 0;
  } catch (error) {
    console.error("feed_prune_failed", error);
  }

  return result;
}
