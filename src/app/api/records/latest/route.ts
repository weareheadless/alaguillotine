import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/hate-store";

export const revalidate = 0;
export const dynamic = "force-dynamic";

/**
 * GET /api/records/latest — the newest claims on the record.
 *
 * The feed already carries them as cards; the front page wants a strip, and a
 * strip should not pull the whole feed to find six rows. Ordered by when the
 * desk first saw them, not by the act's date: a 2014 abatement filed this
 * morning is news about the record this morning.
 */
export async function GET() {
  const db = await getDb();
  if (!db) return Response.json({ items: [] });

  try {
    const rows = await db
      .prepare(
        `SELECT id, url, title, gloss, community, published_at, first_seen_at FROM (
           SELECT id, url, title, gloss, community, published_at, first_seen_at,
                  ROW_NUMBER() OVER (PARTITION BY community ORDER BY first_seen_at DESC) AS rn
             FROM feed_items
            WHERE kind = 'charge'
         ) WHERE rn = 1 ORDER BY first_seen_at DESC LIMIT 6`,
      )
      .bind()
      .all();
    return Response.json(
      {
        items: (rows.results ?? []).map((r) => ({
          id: String(r.id ?? ""),
          url: String(r.url ?? ""),
          title: String(r.title ?? ""),
          gloss: String(r.gloss ?? ""),
          person: String(r.community ?? ""),
          publishedAt: String(r.published_at ?? ""),
          firstSeenAt: String(r.first_seen_at ?? ""),
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return Response.json({ items: [] });
  }
}
