import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rescoreQueue } from "@/lib/hate-store";

export const dynamic = "force-dynamic";

/**
 * GET  /api/admin/challenges — the open challenges, with the row they name.
 * POST /api/admin/challenges — uphold or reject one.
 *
 * Upholding a challenge retracts the claim. That is the same status the judge
 * writes, so the row leaves the archive, the person page and the score in the
 * same pass; rejecting it keeps the row and keeps the challenge on file.
 */

async function db() {
  return getDb();
}

export async function GET(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const d = await db();
  if (!d) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const rows = await d
    .prepare(
      `SELECT ch.id, ch.claim_id, ch.person, ch.sentence, ch.category, ch.detail,
              ch.evidence_url, ch.status, ch.created_at,
              c.status AS claim_status, c.act AS claim_act, doc.url AS source_url
         FROM claim_challenges ch
         LEFT JOIN claims c ON c.id = ch.claim_id
         LEFT JOIN documents doc ON doc.id = c.document_id
        ORDER BY CASE ch.status WHEN 'open' THEN 0 ELSE 1 END, ch.created_at DESC
        LIMIT 100`,
    )
    .all();

  return Response.json(
    { ok: true, challenges: rows.results ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const d = await db();
  if (!d) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    action?: unknown;
    note?: unknown;
  } | null;

  const id = String(body?.id ?? "").trim().slice(0, 120);
  const action = String(body?.action ?? "").trim().toLowerCase();
  const note = String(body?.note ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!id || (action !== "uphold" && action !== "reject")) {
    return Response.json(
      { error: "id and action ('uphold' | 'reject') are required" },
      { status: 400 },
    );
  }

  const challenge = await d
    .prepare("SELECT claim_id, status FROM claim_challenges WHERE id = ? LIMIT 1")
    .bind(id)
    .first<{ claim_id: string; status: string }>();
  if (!challenge) return Response.json({ error: "no such challenge" }, { status: 404 });

  const now = new Date().toISOString();
  let retracted = 0;

  if (action === "uphold") {
    // The same status the judge writes: the row leaves the archive, the person
    // page and the score together.
    const result = (await d
      .prepare("UPDATE claims SET status = 'retracted', updated_at = ? WHERE id = ?")
      .bind(now, challenge.claim_id)
      .run()) as { meta?: { changes?: number } } | undefined;
    retracted = Number(result?.meta?.changes ?? 0);
  }

  await d
    .prepare(
      "UPDATE claim_challenges SET status = ?, resolution = ?, resolved_at = ? WHERE id = ?",
    )
    .bind(action === "uphold" ? "upheld" : "rejected", note, now, id)
    .run();

  let rescored = 0;
  try {
    rescored = await rescoreQueue(d);
  } catch {
    /* the next pass will put the numbers right */
  }

  return Response.json(
    { ok: true, id, action, retracted, rescored },
    { headers: { "Cache-Control": "no-store" } },
  );
}
