import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { ingestLinePerson, type LineTally } from "@/lib/line-ingest";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/findings/line — the pass that matters.
 *
 * It reads the people under the blade by name and keeps what the reporting says
 * they did with their money and power. One person × one outlet per run, walking
 * the line. A conviction is not required; the source sentence is the record.
 */

const OUTLET_ROTATION = [
  "propublica",
  "bylinetimes",
  "motherjones",
  "intercept",
  "reveal",
  "icij",
  "rollingstone",
  "hkfp",
  "premiumtimes",
  "thecity",
  "injusticewatch",
  "trace",
];

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

  const params = new URL(request.url).searchParams;
  const explicitPerson = (params.get("person") ?? "").trim();
  const explicitOutlet = (params.get("outlet") ?? "").trim();
  const per = Math.max(1, Math.min(40, Number(params.get("per") ?? 20) || 20));

  let person = explicitPerson;
  let outlet = explicitOutlet || OUTLET_ROTATION[0];

  const cursor = await db
    .prepare("SELECT position FROM findings_cursor WHERE id = 1 LIMIT 1")
    .first<{ position: number }>();
  const position = Math.max(0, Number(cursor?.position ?? 0));

  if (!person) {
    const people = await db.prepare("SELECT name FROM queue_people ORDER BY rank ASC").all();
    const names = (people.results ?? [])
      .map((row) => String(row.name ?? ""))
      .filter(Boolean);
    if (!names.length) return Response.json({ ok: true, results: [], note: "the line is empty" });
    person = names[position % names.length];
    outlet = explicitOutlet || OUTLET_ROTATION[position % OUTLET_ROTATION.length];
  }

  const results: Array<LineTally | { person: string; outlet: string; error: string }> = [];
  try {
    results.push(await ingestLinePerson(db, person, outlet, per));
  } catch (error) {
    results.push({ person, outlet, error: String(error).slice(0, 180) });
  }

  const next = explicitPerson ? position : position + 1;
  try {
    await db
      .prepare(
        `INSERT INTO findings_cursor (id, position, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`,
      )
      .bind(next, new Date().toISOString())
      .run();
  } catch {
    /* the cursor is scheduling state; a failed write only repeats a name */
  }

  return Response.json(
    { ok: true, person, outlet, position: next, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
