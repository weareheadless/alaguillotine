import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, readClock } from "@/lib/clock-store";
import { dispatchDescription, lastDispatchAt, saveDispatch } from "@/lib/posts-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/refresh — Ada writes the dispatch.
 *
 * Runs on the twelve-hour pass. The Worker does not write the prose itself:
 * it reads the clock, sends the material to Ada on the VPS, and stores what
 * she returns in D1. If she is unreachable the pass fails cleanly and the
 * blog keeps the last dispatch rather than publishing a ghostwriter's voice.
 */

type DispatchPayload = { title?: string; dek?: string; body?: string };

type RefreshEnv = {
  CRON_SECRET?: string;
  CHAT_UPSTREAM?: string;
  ADA_KEY?: string;
};

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as {
    env?: RefreshEnv;
  };
  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const base =
    context.env?.CHAT_UPSTREAM || "https://api.helloada.app/ada";
  const key = context.env?.ADA_KEY || "";

  const last = await lastDispatchAt();
  if (last && Date.now() - Date.parse(last) < 20 * 60 * 60 * 1000) {
    return Response.json({ ok: true, skipped: "recent dispatch" });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const reading = await readClock(db);
  if (!reading) return Response.json({ error: "no clock reading yet" }, { status: 409 });

  const material = reading.items
    .slice(0, 10)
    .map((i) => `- ${i.headline} (${i.source}) ${i.fact}`)
    .join("\n");

  let parsed: DispatchPayload;
  try {
    const res = await fetch(`${base}/dispatch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "X-Ada-Key": key } : {}),
      },
      body: JSON.stringify({
        material,
        level: String(reading.level ?? ""),
        composite: String(reading.composite ?? ""),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      return Response.json(
        { error: `ada dispatch failed: ${res.status}` },
        { status: 502 },
      );
    }
    parsed = (await res.json()) as DispatchPayload;
  } catch {
    return Response.json({ error: "ada dispatch unreachable" }, { status: 502 });
  }

  if (!parsed?.title || !parsed?.body) {
    return Response.json({ error: "ada returned no dispatch" }, { status: 502 });
  }

  const now = new Date();
  const slug = `${now.toISOString().slice(0, 10)}-${parsed.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)}`;

  const publishedAt = now.toISOString();
  const title = parsed.title.slice(0, 90);
  const body = parsed.body.slice(0, 8000);
  const dek = dispatchDescription(
    {
      slug,
      title,
      dek: (parsed.dek ?? "").slice(0, 300),
      body,
      publishedAt,
    },
    155,
  );

  await saveDispatch({
    slug,
    title,
    dek,
    body,
    publishedAt,
  });

  return Response.json({ ok: true, slug, source: "vps-ada" });
}
