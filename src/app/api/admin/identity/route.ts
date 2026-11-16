import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { mergePersonIdentities } from "@/lib/identity";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/admin/identity — one person, one entity.
 *
 * The write-time matcher stops new spellings from splitting a person. This
 * repairs what the record already holds: claims move to the surviving entity,
 * an alias records the spelling that lost, and the queue keeps one row.
 *
 * `?dry=1` reports the groups without touching them.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as { env?: Env };
  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const report = await mergePersonIdentities(db, { dry });

  return Response.json(
    { ok: true, dry, ...report },
    { headers: { "Cache-Control": "no-store" } },
  );
}
