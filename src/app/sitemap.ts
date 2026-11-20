import type { MetadataRoute } from "next";
import { getDb, readQueue } from "@/lib/hate-store";
import { listDispatches } from "@/lib/posts-store";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const BASE = "https://alaguillotine.com";

/**
 * The whole record, one URL at a time.
 *
 * Static pages, every dispatch and every name in the line. The record and the
 * blog are the parts that change, so they are read from D1 at request time
 * rather than frozen into the build.
 *
 * The old ledger's per-row pages are not listed: a row with no passage behind
 * it is not part of the public record (see `getLedgerFor`), and a sitemap is a
 * promise that a URL is worth indexing. Filtered archive views are absent for
 * the same reason — they are views of `/archive`, they carry `noindex`, and a
 * sitemap that lists every combination of filters is a sitemap of one page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/next-in-line`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/feed`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE}/archive`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/archive/readings`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/forum`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/whitepaper`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/submit`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/ada`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
  ];

  const [posts, people] = await Promise.all([
    listDispatches(200).catch(() => []),
    (async () => {
      const db = await getDb();
      return db ? readQueue(db).catch(() => []) : [];
    })(),
  ]);

  const dispatchRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const personRoutes: MetadataRoute.Sitemap = people.map((figure) => ({
    url: `${BASE}/person/${figure.slug || slugify(figure.name)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticRoutes, ...dispatchRoutes, ...personRoutes];
}
