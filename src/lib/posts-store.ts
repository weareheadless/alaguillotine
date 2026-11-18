import { getCloudflareContext } from "@opennextjs/cloudflare";
import { normaliseCategory, type DispatchCategory } from "./dispatch-style";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
  all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
};
type D1 = { prepare: (query: string) => D1Statement };

export interface Dispatch {
  slug: string;
  title: string;
  dek: string;
  body: string;
  publishedAt: string;
  /** The mechanism the piece names; the blog's colour. */
  category: DispatchCategory;
  editorial?: DispatchEditorial;
}

export interface DispatchEditorial {
  version: number;
  whatHappened: string;
  pullQuote: string;
  sources: Array<{ title: string; url: string; quote: string }>;
  correction?: string;
}

export function normaliseEditorial(value: unknown): DispatchEditorial | undefined {
  try {
    const data = (typeof value === "string" ? JSON.parse(value) : value) as Partial<DispatchEditorial> | null;
    if (!data || data.version !== 1 || !Array.isArray(data.sources)) return undefined;
    const sources = data.sources.filter(s => s && typeof s.url === "string" && /^https?:\/\//.test(s.url))
      .slice(0, 6).map(s => ({ title: String(s.title ?? "Source").slice(0, 240), url: s.url.slice(0, 2000), quote: String(s.quote ?? "").slice(0, 600) }));
    if (!sources.length) return undefined;
    return { version: 1, whatHappened: String(data.whatHappened ?? "").slice(0, 700), pullQuote: String(data.pullQuote ?? "").slice(0, 240), sources, correction: data.correction ? String(data.correction).slice(0, 1000) : undefined };
  } catch { return undefined; }
}

async function getDb(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 };
  };
  return context.env?.D1 ?? null;
}

export async function listDispatches(limit = 20): Promise<Dispatch[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .prepare(
      "SELECT slug, title, dek, body, published_at, category, editorial FROM dispatches ORDER BY published_at DESC LIMIT ?",
    )
    .bind(limit)
    .all();
  return (rows.results ?? []).map((r) => ({
    slug: String(r.slug),
    title: String(r.title),
    dek: String(r.dek ?? ""),
    body: String(r.body ?? ""),
    publishedAt: String(r.published_at),
    category: normaliseCategory(r.category),
    editorial: normaliseEditorial(r.editorial),
  }));
}

export async function getDispatch(slug: string): Promise<Dispatch | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db
    .prepare("SELECT slug, title, dek, body, published_at, category, editorial FROM dispatches WHERE slug = ?")
    .bind(slug)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    slug: String(row.slug),
    title: String(row.title),
    dek: String(row.dek ?? ""),
    body: String(row.body ?? ""),
    publishedAt: String(row.published_at),
    category: normaliseCategory(row.category),
    editorial: normaliseEditorial(row.editorial),
  };
}

export async function saveDispatch(dispatch: Dispatch): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO dispatches (slug, title, dek, body, published_at, category, editorial)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title, dek = excluded.dek, body = excluded.body,
          category = excluded.category,
          editorial = CASE WHEN excluded.editorial = '{}' THEN dispatches.editorial ELSE excluded.editorial END`,
    )
    .bind(
      dispatch.slug,
      dispatch.title,
      dispatch.dek,
      dispatch.body,
      dispatch.publishedAt,
      dispatch.category,
      JSON.stringify(normaliseEditorial(dispatch.editorial) ?? {}),
    )
    .run();
}

/** The identity of a piece: its headline reduced to letters and numbers. */
function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The dispatch already on record under this headline, if there is one.
 *
 * The refresh pass names its file after the day it was written
 * (`2026-11-17-roughly-one-verdict`), so a second run on a later day with the
 * same headline used to insert a second row: the same piece, two URLs, twice in
 * the blog and twice in the sitemap. The date belongs to the publication, not
 * to the identity of the piece.
 */
export async function findDispatchByTitle(
  title: string,
): Promise<{ slug: string; title: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const key = titleKey(title);
  if (!key) return null;
  const rows = await db.prepare("SELECT slug, title FROM dispatches").all();
  const hit = (rows.results ?? []).find(
    (row) => titleKey(String(row.title ?? "")) === key,
  );
  return hit ? { slug: String(hit.slug), title: String(hit.title) } : null;
}

/**
 * Publish a dispatch as one row per piece.
 *
 * If the headline is already on record, the existing row is updated and keeps
 * its original URL; the new slug is not created. `publishedAt` moves to this
 * publication so the twenty-hour guard in the refresh pass still knows a piece
 * went out, which is what stops the writer being asked for the same dispatch
 * on every pass.
 */
export async function publishDispatch(
  dispatch: Dispatch,
): Promise<{ slug: string; duplicate: boolean }> {
  const existing = await findDispatchByTitle(dispatch.title);
  const slug = existing?.slug ?? dispatch.slug;

  await saveDispatch({ ...dispatch, slug });

  if (existing) {
    const db = await getDb();
    if (db) {
      await db
        .prepare("UPDATE dispatches SET published_at = ? WHERE slug = ?")
        .bind(dispatch.publishedAt, slug)
        .run();
    }
  }

  return { slug, duplicate: existing ? existing.slug !== dispatch.slug : false };
}

/** Trim at a word boundary, so a meta description never ends mid-word. */
function clipWords(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The dek as the author wrote it, when it reads as a finished sentence.
 * Older dispatches stored a truncated first paragraph, so those still fall
 * back to the description builder instead of surfacing a cut-off line.
 */
export function dispatchDek(post: Dispatch, limit = 300): string {
  const dek = (post.dek ?? "").replace(/\s+/g, " ").trim();
  if (dek.length >= 60 && /[.!?…]["')\]]?$/.test(dek)) return clipWords(dek, limit);
  return dispatchDescription(post);
}

/**
 * The description a dispatch should carry into a meta tag.
 *
 * New dispatches write a complete sentence in `dek`. Older ones stored a
 * truncated first paragraph there, so a dek that does not end like a sentence
 * is replaced by the first sentence of the body.
 */
export function dispatchDescription(post: Dispatch, limit = 155): string {
  const dek = (post.dek ?? "").replace(/\s+/g, " ").trim();
  // A real dek is the best description, even when an older one was cut off
  // at a word boundary. The old truncated deks are still unique; the body's
  // first sentence is not (several old posts open with "Right.").
  if (dek.length >= 60) return clipWords(dek, limit);
  const sentences = (post.body ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/);
  const first = sentences.find((s) => s.trim().length >= 60) ?? sentences[0] ?? "";
  return clipWords(first || dek, limit);
}

export async function lastDispatchAt(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db
    .prepare("SELECT published_at FROM dispatches ORDER BY published_at DESC LIMIT 1")
    .first<{ published_at?: string }>();
  return row?.published_at ?? null;
}
