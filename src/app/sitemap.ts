import type { MetadataRoute } from "next";
import { listClaimRoutes } from "@/lib/archive-store";
import { getDb, readQueue } from "@/lib/hate-store";
import { listDispatches } from "@/lib/posts-store";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const BASE = "https://alaguillotine.com";

/**
 * The whole record, one URL at a time.
 *
 * Static pages, every dispatch, every name in the line, and every claim that
 * has its own page. The record and the blog are the parts that change, so they
 * are read from D1 at request time rather than frozen into the build.
 *
 * Filtered archive views (`/archive?entity=…`, `?q=…`) are deliberately absent:
 * they are views of `/archive`, they carry `noindex`, and a sitemap that lists
 * every combination of filters is a sitemap of the same page.
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

  const [posts, people, claims] = await Promise.all([
    listDispatches(200).catch(() => []),
    (async () => {
      const db = await getDb();
      return db ? readQueue(db).catch(() => []) : [];
    })(),
    listClaimRoutes().catch(() => []),
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

  const claimRoutes: MetadataRoute.Sitemap = claims.map((claim) => {
    const at = claim.at ? new Date(claim.at) : null;
    return {
      url: `${BASE}/archive/claim/${encodeURIComponent(claim.id)}`,
      lastModified: at && !Number.isNaN(at.getTime()) ? at : now,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    };
  });

  return [...staticRoutes, ...dispatchRoutes, ...personRoutes, ...claimRoutes];
}
