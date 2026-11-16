import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { judgeActs, judgeConfig, keepsVerdict } from "@/lib/act-judge";
import { rescoreQueue } from "@/lib/hate-store";

export const dynamic = "force-dynamic";

type Env = {
  CRON_SECRET?: string;
  SITE_AGENT_LLM_API_KEY?: string;
  CLOCK_CHAT_BASE?: string;
  CLOCK_MODEL?: string;
};

/**
 * POST /api/admin/judge — re-read the machine's own acts.
 *
 * The line and discovery passes used to keep a sentence when a name sat near a
 * verb. This pass sends every act they filed to the judge in batches, keeps the
 * ones where the named person is the actor and the act is the kind the record
 * exists for, and retracts the rest.
 *
 * `?limit=` caps the batch (default 40, max 80). `?reset=1` puts the machine's
 * claims back to unjudged and clears the verdict cache, so a changed rubric can
 * be applied again.
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

  const params = new URL(request.url).searchParams;
  const reset = params.get("reset") === "1";
  if (reset) {
    await db
      .prepare(
        "UPDATE claims SET status = 'recorded' WHERE status = 'judged' AND (id LIKE 'claim:line:%' OR id LIKE 'claim:discovery:%')",
      )
      .run();
    await db.prepare("DELETE FROM act_verdicts").run();
  }

  const limit = Math.min(80, Math.max(1, Number(params.get("limit") ?? 40) || 40));
  const rows = await db
    .prepare(
      `SELECT c.id, c.act, c.quote, e.name, d.issuer, d.title
         FROM claims c
         JOIN entities e ON e.id = c.entity_id
         JOIN documents d ON d.id = c.document_id
        WHERE c.status = 'recorded'
          AND (c.id LIKE 'claim:line:%' OR c.id LIKE 'claim:discovery:%')
        ORDER BY c.created_at DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all();

  const items = (rows.results ?? []).map((row) => {
    const sentence = String(row.quote ?? "") || String(row.act ?? "");
    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      sentence,
      outlet: String(row.issuer ?? ""),
      title: String(row.title ?? ""),
    };
  });

  const judge = judgeConfig(context.env ?? {});
  const failures: string[] = [];
  const verdicts = await judgeActs(judge, db, items, failures);

  let kept = 0;
  let retracted = 0;
  const rejected: Array<{ name: string; why: string; act: string }> = [];

  for (const item of items) {
    const verdict = verdicts.get(item.id);
    // No verdict: the judge is unconfigured or the call failed. Leave the row
    // as it is rather than retract on silence.
    if (!verdict) continue;
    if (keepsVerdict(verdict)) {
      await db.prepare("UPDATE claims SET status = 'judged' WHERE id = ?").bind(item.id).run();
      kept += 1;
    } else {
      await db.prepare("UPDATE claims SET status = 'retracted' WHERE id = ?").bind(item.id).run();
      retracted += 1;
      if (rejected.length < 30) {
        rejected.push({ name: item.name, why: verdict.why, act: item.sentence.slice(0, 160) });
      }
    }
  }

  // A retraction removes a charge, so the number and the order move with it.
  let rescored = 0;
  try {
    rescored = await rescoreQueue(db);
  } catch {
    /* the four-hourly pass will still put the numbers right */
  }

  return Response.json(
    {
      ok: true,
      judged: items.length,
      kept,
      retracted,
      rescored,
      configured: Boolean(judge),
      failures: failures.slice(0, 8),
      rejected,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
