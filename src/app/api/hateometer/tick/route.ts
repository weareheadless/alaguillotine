import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ensureSentence,
  executeDueSentences,
  getDb,
  readHate,
  readSentence,
} from "@/lib/hate-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/hateometer/tick — the blade's heartbeat.
 *
 * Sentencing and execution used to happen only when a visitor loaded a page,
 * so a slot was skipped whenever nobody happened to be reading: the blade fell
 * at 09:03 or 09:33, or not at all. This runs every fifteen minutes from the
 * same cron as the wire, costs no model call, and guarantees that an
 * appointment is made when a reading lands and kept when its hour comes.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { CRON_SECRET?: string };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const row = await readHate(db);
  const executed = await executeDueSentences(db);
  const sentence = await ensureSentence(db, row?.computedAt ?? null);
  const pending = sentence ?? (await readSentence(db));

  return Response.json(
    {
      ok: true,
      executed,
      sentenced: pending
        ? { name: pending.person, at: pending.executeAt }
        : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
