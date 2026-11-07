import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { CASES, researchCase } from "@/lib/backfill";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

/**
 * POST /api/backfill?case=<id> — deep research, one case per invocation.
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

  const wanted = new URL(request.url).searchParams.get("case");
  const batch = Math.min(
    5,
    Math.max(1, Number(new URL(request.url).searchParams.get("batch") ?? 1)),
  );
  const db = ctx.env?.D1;

  const hasEntries = async (id: string) => {
    if (!db) return false;
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE case_id = ?")
      .bind(id)
      .all();
    return Number(row.results?.[0]?.n ?? 0) > 0;
  };

  const run: Array<{ case: string; entries: number }> = [];

  // One row per act, not per person per case: the id has to differ when the
  // same name carries several charges.
  const actHash = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };

  for (let n = 0; n < batch; n += 1) {
    let next = wanted ? CASES.find((c) => c.id === wanted) : undefined;
    if (!next) {
      for (const c of CASES) {
        if (!(await hasEntries(c.id))) {
          next = c;
          break;
        }
      }
    }
    if (!next) break;

    const entries = await researchCase(config, next);

    if (db && entries.length) {
      for (const e of entries) {
        await db
          .prepare(
            `INSERT INTO ledger_entries (id, person, role, act, place, year, category, confidence, sources, case_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET act = excluded.act, confidence = excluded.confidence, sources = excluded.sources`,
          )
          .bind(
            `${e.caseId}:${slugify(e.person)}:${actHash(e.act)}`,
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
    }

    run.push({ case: next.id, entries: entries.length });
    if (wanted) break;
  }

  if (!run.length) return Response.json({ ok: true, done: true });
  return Response.json({ ok: true, run });
}
