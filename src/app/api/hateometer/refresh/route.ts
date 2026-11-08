import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { runHatePass } from "@/lib/hate-research";
import { getDb, readHate, readQueue, writeHate, writeQueue } from "@/lib/hate-store";
import { ledgerSummaryFor, readLedgerSummaries, recordAdjustment } from "@/lib/archive-store";
import type { Figure } from "@/lib/hateometer";

export const dynamic = "force-dynamic";

/**
 * POST /api/hateometer/refresh — the queue's research pass.
 *
 * Cron-only. Ada updates everyone already standing in the queue and adds new
 * names when the reporting names them. People are never dropped for a quiet
 * week: their counter decays, their blade rises, they stay on the list.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      DEEPSEEK_API_KEY?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_SEARCH_BASE?: string;
      CLOCK_CHAT_BASE?: string;
      CLOCK_MODEL?: string;
    };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = clockConfig(context.env ?? {});
  if (!config) return Response.json({ error: "no model key configured" }, { status: 500 });

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  try {
    const previous = await readHate(db);
    const queue = await readQueue(db);
    const ledger = await readLedgerSummaries();
    const pass = await runHatePass(config, previous?.level ?? null, queue, ledger);

    // The record counts. Ada scores the week; the ledger adds its bonus and,
    // once there are five or more documented acts, sets a floor under the name.
    const adjust = (f: Figure, base?: number): Figure => {
      const { bonus, floor } = recordAdjustment(ledgerSummaryFor(ledger, f.name));
      const raw = base ?? Math.max(0, f.score - (f.recordBonus ?? 0));
      const score = Math.min(100, Math.max(Math.round((raw + bonus) * 10) / 10, floor));
      return { ...f, score, recordBonus: bonus };
    };

    // Merge today's findings into the standing queue.
    const seen = new Map(pass.figures.map((f) => [f.name.toLowerCase(), f]));
    const merged: Figure[] = queue.map((person) => {
      const fresh = seen.get(person.name.toLowerCase());
      if (fresh) return { ...adjust(fresh), addedAt: person.addedAt };
      // No coverage this pass: the blade rises, the name stays. Decay the
      // report score, not the record bonus, so the record is not eaten twice.
      const base = Math.max(0, person.score - (person.recordBonus ?? 0)) * 0.95;
      return adjust({ ...person, mentions: 0, delta: null }, base);
    });

    const known = new Set(queue.map((p) => p.name.toLowerCase()));
    for (const fresh of pass.figures) {
      if (!known.has(fresh.name.toLowerCase())) {
        merged.push({ ...adjust(fresh), addedAt: pass.computedAt });
      }
    }

    merged.sort((a, b) => b.score - a.score || b.mentions - a.mentions);

    // Ada ranks; this only spaces the ladder. Her order is untouched, but the
    // top of the queue is separated by at least a point so the page cannot
    // show a wall of identical 100s. Only one name can hold 100.
    let ceiling: number | null = null;
    for (const person of merged) {
      if (person.score < 80) break;
      if (ceiling === null) {
        person.score = Math.min(100, person.score);
      } else {
        person.score = Math.min(person.score, Math.round((ceiling - 1) * 10) / 10);
      }
      ceiling = person.score;
    }

    const ranked = merged.map((person, i) => {
      const rank = i + 1;
      const was = queue.find((q) => q.name.toLowerCase() === person.name.toLowerCase());
      return {
        ...person,
        rank,
        prevRank: was?.rank ?? null,
        delta: was ? was.rank - rank : null,
      };
    });

    await writeQueue(db, ranked);
    await writeHate(db, {
      level: pass.level,
      composite: pass.composite,
      dimensions: pass.dimensions,
      figures: ranked,
      sourceHash: pass.sourceHash,
      computedAt: pass.computedAt,
    });

    return Response.json({
      ok: true,
      level: pass.level,
      added: ranked.length - queue.length,
      total: ranked.length,
    });
  } catch (error) {
    console.error("hate_refresh_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "refresh failed" }, { status: 502 });
  }
}
