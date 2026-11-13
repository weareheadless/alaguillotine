import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  run: () => Promise<unknown>;
};
type D1 = { prepare: (query: string) => D1Statement };

export interface Manifesto {
  body: string;
  updatedAt: string | null;
}

export interface ManifestoRevision {
  id: number;
  createdAt: string;
}

async function getDb(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 };
  };
  return context.env?.D1 ?? null;
}

export async function readManifesto(): Promise<Manifesto | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db
    .prepare("SELECT body, updated_at FROM manifesto WHERE id = 'current'")
    .first<Record<string, unknown>>();
  if (!row) return null;
  return { body: String(row.body), updatedAt: String(row.updated_at) };
}

/**
 * Every text she has published, newest first.
 *
 * A manifesto that is overwritten every week with no record of what it used to
 * say is a slogan with a delete key. This keeps the versions, so a visitor can
 * read the one that was standing when they arrived — and see that the document
 * moves.
 */
export async function listRevisions(limit = 12): Promise<ManifestoRevision[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .prepare(
        "SELECT id, created_at FROM manifesto_revisions ORDER BY id DESC LIMIT ?",
      )
      .bind(limit)
      .all<{ id: number; created_at: string }>();
    return (rows.results ?? []).map((r) => ({
      id: Number(r.id),
      createdAt: String(r.created_at),
    }));
  } catch {
    // The table arrives with migration 0012; an old deployment still serves.
    return [];
  }
}

export async function readRevision(id: number): Promise<Manifesto | null> {
  const db = await getDb();
  if (!db || !Number.isFinite(id)) return null;
  try {
    const row = await db
      .prepare("SELECT body, created_at FROM manifesto_revisions WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return { body: String(row.body), updatedAt: String(row.created_at) };
  } catch {
    return null;
  }
}

export async function writeManifesto(body: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const at = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO manifesto (id, body, updated_at) VALUES ('current', ?, ?)
       ON CONFLICT(id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    )
    .bind(body, at)
    .run();
  try {
    await db
      .prepare("INSERT INTO manifesto_revisions (body, created_at) VALUES (?, ?)")
      .bind(body, at)
      .run();
  } catch {
    /* history is a nicety; the current text is the contract */
  }
}
