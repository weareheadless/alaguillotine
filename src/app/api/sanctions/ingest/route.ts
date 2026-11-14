import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ingestSanctions, type SanctionDb } from "@/lib/sanctions";
import { registerQueueNames, type CoverageDb } from "@/lib/coverage";

export const dynamic = "force-dynamic";

/**
 * POST /api/sanctions/ingest — read the register, not the news.
 *
 * Cron-only. No search, no model: the UN consolidated list already carries the
 * name, the date, the stated reason and a reference number. This is the door
 * that keeps working when everything else is down.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { CRON_SECRET?: string; D1?: SanctionDb };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = context.env?.D1;
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const months = Number(new URL(request.url).searchParams.get("months") ?? 24);

  try {
    const run = await ingestSanctions(db, { months });
    await registerQueueNames(db as unknown as CoverageDb);
    return Response.json({ ok: true, ...run });
  } catch (error) {
    console.error(
      "sanctions_ingest_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ error: "ingest failed" }, { status: 502 });
  }
}
