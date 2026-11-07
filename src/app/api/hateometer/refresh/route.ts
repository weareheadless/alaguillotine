import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { runHatePass } from "@/lib/hate-research";
import { getDb, readHate, readQueue, writeHate, writeQueue } from "@/lib/hate-store";
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
    const pass = await runHatePass(config, previous?.level ?? null, queue);

    // Merge today's findings into the standing queue.
    const seen = new Map(pass.figures.map((f) => [f.name.toLowerCase(), f]));
    const merged: Figure[] = queue.map((person) => {
      const fresh = seen.get(person.name.toLowerCase());
      if (fresh) return { ...fresh, addedAt: person.addedAt };
      // No coverage this pass: the blade rises, the name stays.
      return {
        ...person,
        score: Math.round(person.score * 0.95 * 10) / 10,
        mentions: 0,
        delta: null,
      };
    });

    const known = new Set(queue.map((p) => p.name.toLowerCase()));
    for (const fresh of pass.figures) {
      if (!known.has(fresh.name.toLowerCase())) {
        merged.push({ ...fresh, addedAt: pass.computedAt });
      }
    }

    merged.sort((a, b) => b.score - a.score || b.mentions - a.mentions);
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
