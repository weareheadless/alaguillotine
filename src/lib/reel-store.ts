import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
  all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
};
type D1 = { prepare: (query: string) => D1Statement };

export interface ReelClip {
  url: string;
  caption: string;
  source: string;
}

async function getDb(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 };
  };
  return context.env?.D1 ?? null;
}

export async function listReelClips(limit = 8): Promise<ReelClip[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .prepare("SELECT url, caption, source FROM reel_clips ORDER BY found_at DESC LIMIT ?")
    .bind(limit)
    .all();
  return (rows.results ?? []).map((r) => ({
    url: String(r.url),
    caption: String(r.caption ?? ""),
    source: String(r.source ?? ""),
  }));
}

export async function saveReelClip(clip: ReelClip, pageUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO reel_clips (url, caption, source, page_url, found_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET caption = excluded.caption, found_at = excluded.found_at`,
    )
    .bind(clip.url, clip.caption, clip.source, pageUrl, new Date().toISOString())
    .run();
}
