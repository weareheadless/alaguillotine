import { getDb } from "@/lib/clock-store";
import { readFeedPage } from "@/lib/feed";

export const dynamic = "force-dynamic";

/** GET /api/feed?offset=0&limit=12 — the next page of the doom scroll. */
export async function GET(request: Request) {
  const db = await getDb();
  if (!db) {
    return Response.json({ items: [], total: 0 }, { status: 500 });
  }
  const url = new URL(request.url);
  const offset = Math.max(
    0,
    Math.min(5000, Number(url.searchParams.get("offset") ?? 0) || 0),
  );
  const limit = Math.max(
    4,
    Math.min(24, Number(url.searchParams.get("limit") ?? 12) || 12),
  );
  const page = await readFeedPage(db, offset, limit);
  return Response.json(page, {
    headers: { "cache-control": "public, max-age=30" },
  });
}
