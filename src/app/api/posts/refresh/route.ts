import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, readClock } from "@/lib/clock-store";
import { dispatchDescription, lastDispatchAt, listDispatches, publishDispatch, normaliseEditorial } from "@/lib/posts-store";
import { listArchive } from "@/lib/archive-store";
import { normaliseCategory } from "@/lib/dispatch-style";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/refresh — Ada writes the dispatch.
 *
 * Runs on the twelve-hour pass. The Worker does not write the prose itself:
 * it reads the clock, sends the material to Ada on the VPS, and stores what
 * she returns in D1. If she is unreachable the pass fails cleanly and the
 * blog keeps the last dispatch rather than publishing a ghostwriter's voice.
 */

type DispatchPayload = {
  held?: boolean;
  deferred?: boolean;
  reason?: string;
  title?: string;
  dek?: string;
  body?: string;
  category?: string;
  editorial?: unknown;
};

/** A URL slug that stops at a word, not in the middle of one. */
function slugFromTitle(title: string, limit = 64): string {
  const raw = title
    .toLowerCase()
    // "That's" should be "thats", not "that-s".
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (raw.length <= limit) return raw;
  const cut = raw.slice(0, limit);
  const last = cut.lastIndexOf("-");
  return (last > 12 ? cut.slice(0, last) : cut).replace(/-+$/, "");
}

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
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
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

  const [archive, recent] = await Promise.all([listArchive(40), listDispatches(10)]);
  const material = JSON.stringify({
    candidates: reading.items.slice(0, 30).map(i => ({
      title: i.headline, summary: i.fact, url: i.sourceUrl, source: i.source,
      published_at: i.publishedAt,
    })),
    archive: archive.map(i => ({ title: i.headline, summary: i.fact, url: i.sourceUrl, published_at: i.publishedAt })),
    // Her own recent voice is context for the writer, not evidence.
    recent_dispatches: recent.slice(0, 3).map(i => ({
      title: i.title, dek: i.dek, slug: i.slug, published_at: i.publishedAt,
      body: (i.body ?? "").slice(0, 4000),
    })),
  });

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
      // The edge in front of the VPS gives up at about a hundred seconds and
      // returns 524, which used to surface as a 502 and lose the whole run.
      // The VPS checkpoints every stage, so a run that outlives one request is
      // resumed on the next five-minute pass rather than thrown away.
      signal: AbortSignal.timeout(95_000),
    });
    if (!res.ok) {
      if (res.status === 524 || res.status === 504 || res.status >= 500) {
        return Response.json(
          { ok: true, pending: true, note: `upstream ${res.status}, resuming next pass` },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      return Response.json(
        { error: `ada dispatch failed: ${res.status}` },
        { status: 502 },
      );
    }
    parsed = (await res.json()) as DispatchPayload;
  } catch {
    return Response.json(
      { ok: true, pending: true, note: "upstream timed out, resuming next pass" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (parsed?.held === true || parsed?.deferred === true) {
    return Response.json({
      ok: true,
      skipped: parsed.held === true ? "editorial hold" : "investigation deferred",
      reason: String(parsed.reason ?? "").slice(0, 1000),
    });
  }

  if (!parsed?.title || !parsed?.body) {
    return Response.json({ error: "ada returned no dispatch" }, { status: 502 });
  }

  const now = new Date();
  const slug = `${now.toISOString().slice(0, 10)}-${slugFromTitle(parsed.title)}`;

  const publishedAt = now.toISOString();
  const title = parsed.title.slice(0, 90);
  const body = parsed.body.slice(0, 16000);
  const category = normaliseCategory(parsed.category);
  const editorial = normaliseEditorial(parsed.editorial);
  if (!editorial) {
    return Response.json({ error: "dispatch has no verified provenance" }, { status: 502 });
  }
  const dek = dispatchDescription(
    {
      slug,
      title,
      dek: (parsed.dek ?? "").slice(0, 300),
      body,
      publishedAt,
      category,
    },
    155,
  );

  // The date is part of the file name, not part of the piece: a second run on
  // a later day with the same headline updates the existing dispatch instead
  // of publishing it again under a new URL.
  const stored = await publishDispatch({
    slug,
    title,
    dek,
    body,
    publishedAt,
    category,
    editorial,
  });

  return Response.json({
    ok: true,
    slug: stored.slug,
    category,
    source: "vps-ada",
    duplicate: stored.duplicate,
  });
}
