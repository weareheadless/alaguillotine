import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import type { NumbersDb } from "@/lib/numbers";
import { SOURCES } from "@/lib/subsidies";
import { runSubsidyScan } from "@/lib/subsidy-run";

export const revalidate = 0;
export const dynamic = "force-dynamic";

async function db(): Promise<NumbersDb | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: NumbersDb };
  };
  return context.env?.D1 ?? null;
}

/** GET /api/admin/subsidies — the register of sources, and why each is on or off. */
export async function GET(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(
    {
      sources: SOURCES.map((s) => ({
        id: s.id,
        label: s.label,
        jurisdiction: s.jurisdiction,
        url: s.url,
        mode: s.mode,
        enabled: s.enabled,
        note: s.note ?? "",
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/admin/subsidies — fetch every source and write what it states. */
export async function POST(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const database = await db();
  if (!database) return Response.json({ error: "unavailable" }, { status: 503 });

  const reports = await runSubsidyScan(database);
  return Response.json({ reports }, { headers: { "Cache-Control": "no-store" } });
}
