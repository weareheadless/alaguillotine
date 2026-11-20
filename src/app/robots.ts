import type { MetadataRoute } from "next";

/**
 * The sitemap has to be announced, or a crawler has to guess.
 *
 * The site had no robots.txt of its own, so the sitemap was reachable only if
 * something already knew the URL. This names it, and keeps the endpoints out
 * of the crawl.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/submit/"],
      },
    ],
    sitemap: "https://alaguillotine.com/sitemap.xml",
    host: "https://alaguillotine.com",
  };
}
