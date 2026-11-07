import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};
type D1 = { prepare: (query: string) => D1Statement };

export interface Manifesto {
  body: string;
  updatedAt: string | null;
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

export async function writeManifesto(body: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO manifesto (id, body, updated_at) VALUES ('current', ?, ?)
       ON CONFLICT(id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    )
    .bind(body, new Date().toISOString())
    .run();
}
