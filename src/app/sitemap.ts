import type { MetadataRoute } from "next";
import { getDb, readQueue } from "@/lib/hate-store";
import { listDispatches } from "@/lib/posts-store";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const BASE = "https://alaguillotine.com";

/**
 * The whole record, one URL at a time.
 *
 * Static pages, every dispatch, and every name in the line. The queue and the
 * blog are the parts that change, so they are read from D1 at request time
 * rather than frozen into the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/next-in-line`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/archive`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
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
    url: `${BASE}/person/${slugify(figure.name)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticRoutes, ...dispatchRoutes, ...personRoutes];
}
