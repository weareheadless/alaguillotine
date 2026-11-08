import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { DOSSIER_CASES, recentCases, researchDossierCase } from "@/lib/dossier";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

/**
 * POST /api/backfill/person — the long record, one person and one angle at a
 * time.
 *
 * The theatre matrix sweeps places; this sweeps people. Each case is a
 * person × angle (finance, power, migration, war, labour, climate, courts,
 * foreign) over a long window. The cron walks the pending cases; a manual call
 * can target a name, an angle, or both.
 *
 * Query:
 *   ?status=1
 *   ?person=Elon%20Musk&angle=finance&batch=1
 *   ?recent=1&batch=3   (rolling last-four-days sweep, one case per person)
 *   ?batch=2
 *   ?force=1   (re-run cases already recorded)
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
  const wantedPerson = (url.searchParams.get("person") ?? "").trim().toLowerCase();
  const wantedAngle = (url.searchParams.get("angle") ?? "").trim().toLowerCase();
  const force = url.searchParams.get("force") === "1";
  const batch = Math.min(4, Math.max(1, Number(url.searchParams.get("batch") ?? 1)));
  const db = ctx.env?.D1;

  const done = new Set<string>();
  if (db) {
    try {
      const rows = await db
        .prepare("SELECT case_id FROM ledger_cases WHERE case_id LIKE 'dossier:%'")
        .bind()
        .all();
      for (const r of rows.results ?? []) done.add(String(r.case_id));
    } catch {
      /* table not created yet */
    }
  }

  // ?recent=1 runs the rolling news sweep: one short-window case per standing
  // person per day, so the archive keeps up with the week instead of waiting
  // for the angle rotation to come round.
  const recent = url.searchParams.get("recent") === "1";
  let candidates = (recent ? recentCases() : DOSSIER_CASES).filter(
    (c) => !wantedPerson || c.person.toLowerCase() === wantedPerson,
  );
  if (wantedAngle) candidates = candidates.filter((c) => c.angle === wantedAngle);

  if (url.searchParams.get("status")) {
    const pending = candidates.filter((c) => !done.has(c.id));
    return Response.json({
      ok: true,
      total: candidates.length,
      done: candidates.length - pending.length,
      pending: pending.length,
      next: pending.slice(0, 12).map((c) => ({ case: c.id, person: c.person, angle: c.angle })),
    });
  }

  const pending = candidates.filter((c) => force || !done.has(c.id));
  const run: Array<{ case: string; person: string; angle: string; entries: number }> = [];

  const actHash = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  for (let n = 0; n < batch && n < pending.length; n += 1) {
    const next = pending[n];
    const entries = await researchDossierCase(config, next);

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
    run.push({
      case: next.id,
      person: next.person,
      angle: next.angle,
      entries: entries.length,
    });
  }

  if (!run.length) return Response.json({ ok: true, done: true });
  return Response.json({ ok: true, run });
}
