import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_CONTENT, deepMergeContent, validateSiteContent, type SiteContent } from "@/lib/content";

/**
 * GET /api/content — serves the Ada Guillotine-editable site copy.
 *
 * Reads `data/site-content.json` from disk, validates it, deep-merges it over
 * the bundled DEFAULT_CONTENT, and returns the result with `Cache-Control:
 * no-store` so Ada's edits appear immediately. Results are cached in memory
 * keyed by file mtime with a 5-second TTL. Any read/parse/validation failure
 * falls back to DEFAULT_CONTENT — the route never 500s.
 */

const CONTENT_FILE = path.join(process.cwd(), "data", "site-content.json");
const CACHE_TTL_MS = 5_000;

let cache: { mtimeMs: number; fetchedAt: number; content: SiteContent } | null = null;

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const stat = await fs.stat(CONTENT_FILE);
    const now = Date.now();

    if (cache && cache.mtimeMs === stat.mtimeMs && now - cache.fetchedAt < CACHE_TTL_MS) {
      return Response.json(cache.content, { headers });
    }

    const raw = await fs.readFile(CONTENT_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (validateSiteContent(parsed).length > 0) {
      return Response.json(DEFAULT_CONTENT, { headers });
    }

    const content = deepMergeContent(DEFAULT_CONTENT, parsed);
    cache = { mtimeMs: stat.mtimeMs, fetchedAt: now, content };
    return Response.json(content, { headers });
  } catch {
    return Response.json(DEFAULT_CONTENT, { headers });
  }
}
