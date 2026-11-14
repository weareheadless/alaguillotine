import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  listNumbers,
  numberCounts,
  reviewNumber,
  type NumberStatus,
  type NumbersDb,
} from "@/lib/numbers-review";

export const revalidate = 0;
export const dynamic = "force-dynamic";

async function db(): Promise<NumbersDb | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: NumbersDb };
  };
  return context.env?.D1 ?? null;
}

/** GET /api/admin/numbers?status=pending — the figures waiting for a reader. */
export async function GET(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const database = await db();
  if (!database) return Response.json({ error: "unavailable" }, { status: 503 });

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "pending") as NumberStatus | "all";
  const [rows, counts] = await Promise.all([
    listNumbers(database, { status, limit: Number(url.searchParams.get("limit") ?? 100) }),
    numberCounts(database),
  ]);
  return Response.json({ rows, counts }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/admin/numbers — accept, reject or hold one figure. */
export async function POST(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const database = await db();
  if (!database) return Response.json({ error: "unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await reviewNumber(database, {
    slug: String(body.slug ?? ""),
    kind: String(body.kind ?? ""),
    label: String(body.label ?? ""),
    status: String(body.status ?? "pending") as NumberStatus,
    qualifier: typeof body.qualifier === "string" ? body.qualifier : undefined,
    whose: typeof body.whose === "string" ? body.whose : undefined,
    grade: typeof body.grade === "string" ? body.grade : undefined,
    basis: typeof body.basis === "string" ? body.basis : undefined,
  });
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
