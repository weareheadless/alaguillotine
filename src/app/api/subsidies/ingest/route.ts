import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NumbersDb } from "@/lib/numbers";
import { runSubsidyScan } from "@/lib/subsidy-run";

export const dynamic = "force-dynamic";

/**
 * POST /api/subsidies/ingest — the monthly state and local pass.
 *
 * Cron-only. Each source is a register the state publishes: the engine fetches
 * it, reads the line, matches the company to the person who runs it and writes
 * the figure with its instrument. A source that is down reports its error and
 * leaves its rows alone.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { CRON_SECRET?: string; D1?: NumbersDb };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = context.env?.D1;
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  try {
    const reports = await runSubsidyScan(db);
    return Response.json({ ok: true, reports }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
