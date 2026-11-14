import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";
import {
  auditEvidence,
  listEvidence,
  rankedWorklist,
  reviewCounts,
  reviewEvidence,
  type ReviewDb,
  type ReviewStatus,
} from "@/lib/evidence-review";

export const revalidate = 0;
export const dynamic = "force-dynamic";

async function db(): Promise<ReviewDb | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: ReviewDb };
  };
  return context.env?.D1 ?? null;
}

/** GET /api/admin/evidence?status=pending&person=&limit= — the review queue. */
export async function GET(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const database = await db();
  if (!database) return Response.json({ error: "unavailable" }, { status: 503 });

  const url = new URL(request.url);
  if (url.searchParams.get("view") === "ranked") {
    const [people, counts] = await Promise.all([
      rankedWorklist(database),
      reviewCounts(database),
    ]);
    return Response.json(
      { people, counts },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const status = (url.searchParams.get("status") ?? "pending") as ReviewStatus | "all";
  const [page, counts] = await Promise.all([
    listEvidence(database, {
      status,
      person: url.searchParams.get("person") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50),
      offset: Number(url.searchParams.get("offset") ?? 0),
    }),
    reviewCounts(database),
  ]);

  return Response.json(
    { ...page, counts },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * POST /api/admin/evidence
 *   { id, status, note }  — accept, reject or send back to pending
 *   { audit: true }       — run the mechanical audit over legacy claims
 */
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

  // Spelling is not identity: link two spellings of one person. The scorer
  // then counts both under the canonical name.
  if (body.alias && body.canonical) {
    const alias = String(body.alias).trim().toLowerCase();
    const canonical = String(body.canonical).trim();
    if (!alias || !canonical) {
      return Response.json({ error: "alias and canonical are required" }, { status: 400 });
    }
    await database
      .prepare(
        `INSERT INTO person_aliases (alias, canonical, note, at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(alias) DO UPDATE SET canonical = excluded.canonical, note = excluded.note`,
      )
      .bind(alias, canonical, String(body.note ?? "").slice(0, 300), new Date().toISOString())
      .run();
    return Response.json({ ok: true, alias, canonical });
  }

  if (body.audit === true) {
    const report = await auditEvidence(database);
    return Response.json({ ok: true, ...report }, { headers: { "Cache-Control": "no-store" } });
  }

  const id = String(body.id ?? "");
  const status = String(body.status ?? "") as ReviewStatus;
  if (!id || !status) {
    return Response.json({ error: "id and status are required" }, { status: 400 });
  }

  const result = await reviewEvidence(database, {
    id,
    status,
    note: typeof body.note === "string" ? body.note : "",
    reviewer: typeof body.reviewer === "string" ? body.reviewer : undefined,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(
    { ok: true, row: result.row },
    { headers: { "Cache-Control": "no-store" } },
  );
}
