import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { runHatePass } from "@/lib/hate-research";
import { getDb, readHate, readQueue, writeHate, writeQueue } from "@/lib/hate-store";
import { ledgerSummaryFor, readLedgerSummaries } from "@/lib/archive-store";
import { registerQueueNames } from "@/lib/coverage";
import type { Figure } from "@/lib/hateometer";

export const dynamic = "force-dynamic";

/**
 * POST /api/hateometer/refresh — the queue's research pass.
 *
 * Cron-only. Ada updates everyone already standing in the queue and adds new
 * names when the reporting names them.
 *
 * The number written here is not the model's reading. It is the harm the
 * ledger documents inside the evidence window, weighted by confidence and
 * category. A name the wire forgot keeps the number its record earns; a name
 * the wire loves cannot outrun a thin record. Nobody is dropped for a quiet
 * week, and nobody is carried by arithmetic.
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

    // The number is the record inside the window — not the pass's reading,
    // not a bonus, and not a floor for lifetime volume.
    const evidenceScore = (name: string): number =>
      ledgerSummaryFor(ledger, name)?.evidence ?? 0;

    // Merge today's findings into the standing queue. The pass still decides
    // who is nominated and what the charge reads; it no longer decides the
    // order. That is the ledger's job.
    const seen = new Map(pass.figures.map((f) => [f.name.toLowerCase(), f]));
    const merged: Figure[] = queue.map((person) => {
      const fresh = seen.get(person.name.toLowerCase());
      const score = evidenceScore(person.name);
      if (fresh) return { ...person, ...fresh, score, addedAt: person.addedAt };
      return { ...person, mentions: 0, delta: null, score };
    });

    const known = new Set(queue.map((p) => p.name.toLowerCase()));
    for (const fresh of pass.figures) {
      if (!known.has(fresh.name.toLowerCase())) {
        merged.push({
          ...fresh,
          score: evidenceScore(fresh.name),
          addedAt: pass.computedAt,
        });
      }
    }

    // Sorted by the evidence, then by how many acts are behind it. No ceiling
    // clamp: the number is the number, and a tie should read as a tie.
    merged.sort(
      (a, b) => b.score - a.score || (b.mentions ?? 0) - (a.mentions ?? 0),
    );

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
    // A new name is registered for its first look the moment it enters the
    // line, not whenever the next coverage cron happens to run.
    await registerQueueNames(db);
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
