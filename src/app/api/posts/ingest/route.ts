import { getCloudflareContext } from "@opennextjs/cloudflare";
import { saveDispatch } from "@/lib/posts-store";
import { normaliseCategory } from "@/lib/dispatch-style";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/ingest — Ada's blog, pushed from the VPS.
 *
 * Her long-form drafts are written and published on the VPS. This endpoint is
 * the bridge that puts them on the public site's /blog: the VPS authenticates
 * with the same internal cron secret, and the dispatch lands in D1.
 *
 * This is deliberately one-way. The Worker does not write her posts; it only
 * stores what she shipped.
 */

type IngestEnv = { CRON_SECRET?: string };

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as {
    env?: IngestEnv;
  };
  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    slug?: string;
    title?: string;
    dek?: string;
    body?: string;
    publishedAt?: string;
    category?: string;
  } | null;

  const slug = String(payload?.slug ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const title = String(payload?.title ?? "").trim().slice(0, 120);
  const body = String(payload?.body ?? "").trim().slice(0, 20000);
  if (!slug || !title || !body) {
    return Response.json(
      { error: "slug, title and body are required" },
      { status: 400 },
    );
  }

  const publishedAt = payload?.publishedAt
    ? new Date(payload.publishedAt)
    : new Date();
  if (Number.isNaN(publishedAt.getTime())) {
    return Response.json({ error: "invalid publishedAt" }, { status: 400 });
  }

  const category = normaliseCategory(payload?.category);

  await saveDispatch({
    slug,
    title,
    dek: String(payload?.dek ?? "").trim().slice(0, 300),
    body,
    publishedAt: publishedAt.toISOString(),
    category,
  });

  return Response.json({ ok: true, slug, category });
}
