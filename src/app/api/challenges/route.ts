import { getDb } from "@/lib/clock-store";
import { PASSAGE_SQL } from "@/lib/passage";

export const dynamic = "force-dynamic";

/**
 * POST /api/challenges — a reader says a row is wrong.
 *
 * No account, no email. The claim must be on the public record, the reason has
 * to be a sentence rather than a grunt, and the same complaint about the same
 * claim is one challenge, not ten. An open challenge is reviewed by hand; if
 * the sentence does not hold, the claim is retracted and leaves the page, the
 * score and the archive.
 */

const CATEGORIES = new Set([
  "wrong-person",
  "wrong-fact",
  "fabricated",
  "missing-context",
  "other",
]);

async function sha16(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function POST(request: Request) {
  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const payload = (await request.json().catch(() => null)) as {
    claimId?: unknown;
    category?: unknown;
    detail?: unknown;
    url?: unknown;
  } | null;

  const claimId = String(payload?.claimId ?? "").trim().slice(0, 200);
  const category = String(payload?.category ?? "other").trim().toLowerCase();
  const detail = String(payload?.detail ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
  const url = String(payload?.url ?? "").trim().slice(0, 500);

  if (!claimId || detail.length < 20) {
    return Response.json(
      { error: "Say what is wrong in at least a sentence (20 characters)." },
      { status: 400 },
    );
  }
  if (!CATEGORIES.has(category)) {
    return Response.json({ error: "unknown category" }, { status: 400 });
  }
  if (url && !/^https?:\/\//i.test(url)) {
    return Response.json({ error: "the link must start with http" }, { status: 400 });
  }

  // The claim has to be one the site is actually publishing.
  let claim: { id: string; name: string; act: string } | null = null;
  try {
    claim = await (db as Db)
      .prepare(
        `SELECT c.id AS id, e.name AS name, c.act AS act
           FROM claims c
           JOIN entities e ON e.id = c.entity_id
           JOIN documents d ON d.id = c.document_id
          WHERE c.id = ? AND d.kind = 'press' AND c.status != 'retracted'
            AND ${PASSAGE_SQL}
          LIMIT 1`,
      )
      .bind(claimId)
      .first<{ id: string; name: string; act: string }>();
  } catch {
    claim = null;
  }
  if (!claim) {
    return Response.json({ error: "no such claim on the record" }, { status: 404 });
  }

  const ip =
    request.headers.get("cf-connecting-ip") ??
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0] ??
    "";
  // Enough to rate-limit, not enough to identify anyone in the table.
  const ipHash = await sha16(`${ip.trim()}|ala-challenge|v1`);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const recent = await (db as Db)
      .prepare(
        "SELECT COUNT(*) AS n FROM claim_challenges WHERE ip_hash = ? AND created_at > ?",
      )
      .bind(ipHash, since)
      .first<{ n: number }>();
    if (Number(recent?.n ?? 0) >= 5) {
      return Response.json(
        { error: "too many challenges from this connection in an hour" },
        { status: 429 },
      );
    }
  } catch {
    /* table not created yet: the insert will say so */
  }

  const id = `chal:${await sha16(`${claim.id}|${detail.toLowerCase()}`)}`;
  const now = new Date().toISOString();
  try {
    await (db as Db)
      .prepare(
        `INSERT OR IGNORE INTO claim_challenges
           (id, claim_id, person, sentence, category, detail, evidence_url, ip_hash, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .bind(
        id,
        claim.id,
        claim.name,
        String(claim.act ?? "").slice(0, 600),
        category,
        detail,
        url,
        ipHash,
        now,
      )
      .run();
  } catch (error) {
    console.error(
      "challenge_write_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ error: "could not file the challenge" }, { status: 500 });
  }

  return Response.json(
    { ok: true, id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
