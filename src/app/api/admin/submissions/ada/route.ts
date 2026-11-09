import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import { reviewByAda, type ReviewEnv } from "@/lib/ada-review";
import {
  getSubmissionByCode,
  listSubmissions,
  type D1,
} from "@/lib/submissions";

export const revalidate = 0;

/**
 * POST /api/admin/submissions/ada — run Ada's review over proposals that were
 * filed before the automatic pass existed, or over one stuck row.
 *
 * Body: { code?: string }. Without a code it takes the two oldest pending
 * proposals, so the request finishes inside the Worker's lifetime.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 } & ReviewEnv;
  };
  const db = context.env?.D1;
  if (!db) return Response.json({ error: "unavailable" }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const code = String(body.code ?? "").trim().toUpperCase();

  let items;
  if (code) {
    const one = await getSubmissionByCode(db, code);
    if (!one) return Response.json({ error: "not found" }, { status: 404 });
    items = [one];
  } else {
    items = (await listSubmissions(db, "pending", 2)).reverse();
  }

  const results: Array<{ code: string; status: string; verdict: string }> = [];
  for (const item of items) {
    if (item.status !== "pending") {
      results.push({ code: item.code, status: item.status, verdict: item.verdict });
      continue;
    }
    await reviewByAda(db, item, context.env ?? {});
    const fresh = await getSubmissionByCode(db, item.code);
    results.push({
      code: item.code,
      status: fresh?.status ?? "pending",
      verdict: fresh?.verdict ?? "",
    });
  }

  return Response.json(
    { ok: true, results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
