import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  listSubmissions,
  reviewSubmission,
  type D1,
  type SubmissionStatus,
} from "@/lib/submissions";

export const revalidate = 0;

async function db(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 };
  };
  return context.env?.D1 ?? null;
}

/** GET /api/admin/submissions?status=pending — the review queue. */
export async function GET(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const database = await db();
  if (!database) return Response.json({ error: "unavailable" }, { status: 503 });

  const status = (new URL(request.url).searchParams.get("status") ??
    "pending") as SubmissionStatus | "all";
  const submissions = await listSubmissions(database, status);
  return Response.json(
    { submissions },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/admin/submissions — approve or reject one name. */
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

  const id = String(body.id ?? "");
  const action = body.action === "approve" ? "approve" : "reject";
  const verdict = String(body.verdict ?? "").trim().slice(0, 800);
  const score = Number(body.score ?? 0);

  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  if (verdict.length < 10) {
    return Response.json(
      { error: "the verdict needs a real reason, at least a sentence" },
      { status: 400 },
    );
  }

  const result = await reviewSubmission(database, {
    id,
    action,
    verdict,
    score: Number.isFinite(score) ? score : 0,
    role: String(body.role ?? ""),
    country: String(body.country ?? ""),
    reviewer: "ada",
  });

  if (!result.ok) {
    return Response.json({ error: result.error ?? "failed" }, { status: 400 });
  }
  return Response.json({ ok: true, submission: result.submission });
}