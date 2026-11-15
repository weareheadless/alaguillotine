import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { exactSpan, isFurniture } from "@/lib/register/passage";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/verify?limit=100 — make every stored passage checkable.
 *
 * The re-grounding pass wrote quotes with whitespace collapsed, so 125 of the
 * 284 mechanically matched claims could not be found in the document they came
 * from: not because the sentence was invented, but because the stored copy was
 * normalised and the document was not. A claim whose passage has to be
 * reconstructed to be checked is a claim that cannot be checked by a reader.
 *
 * This pass rewrites each quote as the exact byte range in the stored text. If
 * the sentence is no longer there at all, the claim drops to `alleged` — press
 * only, no passage — instead of keeping a status that implies one. And if the
 * "sentence" is a byline, a reading time or a login prompt, it drops for the
 * same reason: page furniture is not evidence.
 *
 * Nothing here decides whether a claim is true. It decides whether the passage
 * the claim points at exists, and it is allowed to say no.
 */

function hashOf(value: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(value))
    .then((digest) =>
      [...new Uint8Array(digest)]
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
}

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as { env?: Env };
  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const limit = Math.max(1, Math.min(400, Number(new URL(request.url).searchParams.get("limit") ?? 100) || 100));
  const started = new Date().toISOString();
  const now = started;

  const queue = await db
    .prepare(
      `SELECT c.id, cd.quote, cd.document_id, d.text_excerpt AS text
         FROM claims c
         JOIN claim_documents cd ON cd.claim_id = c.id
         JOIN documents d ON d.id = cd.document_id
        WHERE c.status = 'matched' AND cd.quote != ''
          -- Only what cannot be found. A repaired passage leaves the queue, so
          -- repeated calls make progress instead of re-reading the first page.
          AND instr(d.text_excerpt, cd.quote) = 0
        ORDER BY c.id
        LIMIT ?`,
    )
    .bind(limit)
    .all();

  const rows = (queue.results ?? []).map((row) => ({
    claimId: String(row.id ?? ""),
    quote: String(row.quote ?? ""),
    documentId: String(row.document_id ?? ""),
    text: String(row.text ?? ""),
  }));

  const tally = { examined: rows.length, repaired: 0, furniture: 0, missing: 0, unchanged: 0 };

  for (const row of rows) {
    const span = row.text ? exactSpan(row.text, row.quote) : null;

    if (!span) {
      tally.missing += 1;
      await db
        .prepare(
          `UPDATE claims SET status = 'alleged', confidence = 0.2, confidence_basis = ?, updated_at = ?
            WHERE id = ?`,
        )
        .bind(
          "the passage stored with this claim no longer appears in the document; it needs re-grounding",
          now,
          row.claimId,
        )
        .run();
      await db
        .prepare("UPDATE claim_documents SET quote = '', locator = '' WHERE claim_id = ? AND document_id = ?")
        .bind(row.claimId, row.documentId)
        .run();
      continue;
    }

    if (isFurniture(span.exact)) {
      tally.furniture += 1;
      await db
        .prepare(
          `UPDATE claims SET status = 'alleged', confidence = 0.2, confidence_basis = ?, updated_at = ?
            WHERE id = ?`,
        )
        .bind(
          "the located passage was page furniture (byline, reading time, navigation), not the claim",
          now,
          row.claimId,
        )
        .run();
      await db
        .prepare("UPDATE claim_documents SET quote = '', locator = '' WHERE claim_id = ? AND document_id = ?")
        .bind(row.claimId, row.documentId)
        .run();
      continue;
    }

    // The stored quote may already be the exact slice and still differ from the
    // normalised needle, so compare the slice, not the search.
    if (span.exact === row.quote || span.verbatim) {
      tally.unchanged += 1;
      continue;
    }

    tally.repaired += 1;
    await db
      .prepare(
        "UPDATE claim_documents SET quote = ?, locator = ? WHERE claim_id = ? AND document_id = ?",
      )
      .bind(span.exact, `chars ${span.start}-${span.end}`, row.claimId, row.documentId)
      .run();
    await db
      .prepare(
        `UPDATE claims SET confidence_basis = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(
        `passage stored verbatim at chars ${span.start}-${span.end}; mechanically located, not yet reviewed (${await hashOf(span.exact)})`,
        now,
        row.claimId,
      )
      .run();
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('verify', ?, ?, ?, ?)",
      )
      .bind(
        started,
        new Date().toISOString(),
        tally.repaired + tally.furniture + tally.missing,
        tally.furniture || tally.missing
          ? `${tally.furniture} furniture, ${tally.missing} missing`
          : null,
      )
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json({ ok: true, ...tally }, { headers: { "Cache-Control": "no-store" } });
}
