import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { CASES, researchCase } from "@/lib/backfill";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

/**
 * POST /api/backfill — deep research, a few cases per invocation.
 *
 * Every case is recorded in ledger_cases whether it found anything or not, so
 * an empty case does not block the queue forever. Entries are keyed on the act
 * itself, not the case, so the same charge found by two different sweeps lands
 * once.
 */
export async function POST(request: Request) {
  const ctx = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      DEEPSEEK_API_KEY?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_CHAT_BASE?: string;
      CLOCK_MODEL?: string;
      D1?: {
        prepare: (q: string) => {
          bind: (...v: unknown[]) => {
            run: () => Promise<unknown>;
            all: () => Promise<{ results?: Array<Record<string, unknown>> }>;
          };
        };
      };
    };
  };

  const secret = ctx.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = clockConfig(ctx.env ?? {});
  if (!config) return Response.json({ error: "no model key" }, { status: 500 });

  const url = new URL(request.url);
  const wanted = url.searchParams.get("case");
  const batch = Math.min(5, Math.max(1, Number(url.searchParams.get("batch") ?? 1)));
  const db = ctx.env?.D1;

  const done = new Set<string>();
  if (db) {
    try {
      const rows = await db.prepare("SELECT case_id FROM ledger_cases").bind().all();
      for (const r of rows.results ?? []) done.add(String(r.case_id));
    } catch {
      /* table not created yet */
    }
  }

  if (url.searchParams.get("status")) {
    if (!db) return Response.json({ error: "no db" }, { status: 500 });
    const total = await db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").bind().all();
    const byYear = await db
      .prepare("SELECT year, COUNT(*) AS n FROM ledger_entries GROUP BY year ORDER BY year")
      .bind()
      .all();
    const pending = CASES.filter((c) => !done.has(c.id)).map((c) => c.id);
    return Response.json({
      ok: true,
      cases: CASES.length,
      done: CASES.length - pending.length,
      pending: pending.length,
      next: pending.slice(0, 10),
      entries: Number(total.results?.[0]?.n ?? 0),
      byYear: byYear.results ?? [],
    });
  }

  const run: Array<{ case: string; entries: number }> = [];

  // One row per act, not per person per case: the id has to differ when the
  // same name carries several charges, and has to match when two sweeps find
  // the same act.
  const actHash = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  for (let n = 0; n < batch; n += 1) {
    let next = wanted ? CASES.find((c) => c.id === wanted) : undefined;
    if (!next) next = CASES.find((c) => !done.has(c.id));
    if (!next) break;

    const entries = await researchCase(config, next);

    if (db) {
      for (const e of entries) {
        await db
          .prepare(
            `INSERT INTO ledger_entries (id, person, role, act, place, year, category, confidence, sources, case_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET act = excluded.act, confidence = excluded.confidence, sources = excluded.sources`,
          )
          .bind(
            `${slugify(e.person)}:${actHash(norm(e.act))}`,
            e.person,
            e.role,
            e.act,
            e.place,
            e.year,
            e.category,
            e.confidence,
            JSON.stringify(e.sources),
            e.caseId,
            new Date().toISOString(),
          )
          .run();
      }

      await db
        .prepare(
          `INSERT INTO ledger_cases (case_id, attempted_at, entries)
           VALUES (?, ?, ?)
           ON CONFLICT(case_id) DO UPDATE SET attempted_at = excluded.attempted_at, entries = excluded.entries`,
        )
        .bind(next.id, new Date().toISOString(), entries.length)
        .run();
    }

    done.add(next.id);
    run.push({ case: next.id, entries: entries.length });
    if (wanted) break;
  }

  if (!run.length) return Response.json({ ok: true, done: true });
  return Response.json({ ok: true, run });
}
