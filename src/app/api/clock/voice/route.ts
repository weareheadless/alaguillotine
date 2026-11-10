import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fetchAdaVoice } from "@/lib/ada-voice";
import { isAdminAuthed } from "@/lib/admin-auth";
import { keepDailyPromise } from "@/lib/clock";
import { getDb, readClock, writeClock } from "@/lib/clock-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/clock/voice — rewrite the site voice without a new reading.
 *
 * The four-hour pass does this as part of the reading. This is for the desk:
 * when the promise or the popups need to change now, and the numbers, items
 * and scores should stay exactly where they are.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { CHAT_UPSTREAM?: string; ADA_KEY?: string };
  };

  const db = await getDb();
  if (!db) return Response.json({ error: "no db" }, { status: 500 });

  const row = await readClock(db);
  if (!row) return Response.json({ error: "no reading" }, { status: 404 });

  const result = await fetchAdaVoice(ctx.env ?? {}, row.level, row.composite, row.items);
  if (!result) {
    return Response.json({ error: "voice unavailable" }, { status: 502 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const voice = force ? result.voice : keepDailyPromise(result.voice, row.voice);
  const items = row.items.map((item, i) => {
    const quip = result.quips[i];
    return quip?.trim() ? { ...item, quip: quip.trim().slice(0, 160) } : item;
  });

  await writeClock(db, { ...row, items, voice });

  return Response.json(
    { ok: true, mood: voice.mood, promise: voice.promise ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
