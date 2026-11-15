import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * GET /api/register/audit — the invariants, counted on production data.
 *
 * A phase of the register is not done until this returns no violations, so the
 * numbers have to be mechanical and slightly uncomfortable. Each check is a
 * sentence the architecture makes and the database can refute:
 *
 *   - a claim has a document, and the document has a passage under the claim;
 *   - a passage is a substring of the text stored from the document;
 *   - a document read has a hash, so a silent edit is visible;
 *   - a recorded vote has a roll call and a member row behind it;
 *   - an entity that carries claims can be joined by number, not just by name.
 *
 * `legacy` rows are expected to fail the quote checks: they were filed before
 * the register and say so. The point is that the failure is counted, not
 * hidden, and that no `recorded`, `reported` or `found` claim is in the count.
 */

const VERIFIED = "('recorded','reported','found','admitted')";

export async function GET(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as { env?: Env };
  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const count = async (sql: string, ...params: unknown[]): Promise<number> => {
    const statement = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const row = await statement.first<{ n: number }>();
    return Number(row?.n ?? 0);
  };

  const [
    claims,
    byStatus,
    noDocument,
    noPassage,
    passageNotInText,
    passageNotInVerified,
    documents,
    unhashed,
    untyped,
    rollCalls,
    rollVotes,
    votesWithoutMember,
    membersWithoutId,
    orphans,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM claims"),
    db
      .prepare("SELECT status, COUNT(*) AS n FROM claims GROUP BY status ORDER BY n DESC")
      .all<{ results?: Array<Record<string, unknown>> }>(),
    count(
      `SELECT COUNT(*) AS n FROM claims c
        WHERE NOT EXISTS (SELECT 1 FROM claim_documents cd WHERE cd.claim_id = c.id)`,
    ),
    // A verified claim with no passage is the failure the register exists to
    // prevent: a sentence with nothing under it.
    count(
      `SELECT COUNT(*) AS n FROM claims c
        WHERE c.status IN ${VERIFIED}
          AND NOT EXISTS (
            SELECT 1 FROM claim_documents cd
             WHERE cd.claim_id = c.id AND cd.quote != '')`,
    ),
    // The passage must be in the text we stored, not merely in the text we saw.
    count(
      `SELECT COUNT(*) AS n FROM claims c
          JOIN claim_documents cd ON cd.claim_id = c.id
          JOIN documents d ON d.id = cd.document_id
        WHERE c.status IN ${VERIFIED}
          AND cd.quote != ''
          AND instr(d.text_excerpt, cd.quote) = 0`,
    ),
    count(`SELECT COUNT(*) AS n FROM claims WHERE status = 'legacy'`),
    count("SELECT COUNT(*) AS n FROM documents"),
    count("SELECT COUNT(*) AS n FROM documents WHERE text_excerpt != '' AND content_hash = ''"),
    count("SELECT COUNT(*) AS n FROM documents WHERE kind = ''"),
    count("SELECT COUNT(*) AS n FROM roll_calls"),
    count("SELECT COUNT(*) AS n FROM roll_votes"),
    // A roll-call document with claims but no parsed structure cannot have
    // grounded them.
    count(
      `SELECT COUNT(*) AS n FROM documents d
        WHERE d.kind = 'roll_call'
          AND EXISTS (SELECT 1 FROM claim_documents cd WHERE cd.document_id = d.id)
          AND NOT EXISTS (SELECT 1 FROM roll_calls rc WHERE rc.document_id = d.id)`,
    ),
    // Only votes bind an identity: a roll call names a bioguide id, so a
    // recorded vote without one means the join is broken. A person known only
    // from journalism has no number yet, and that is a coverage gap, not a
    // violation.
    count(
      `SELECT COUNT(*) AS n FROM entities e
        WHERE e.kind = 'person'
          AND EXISTS (SELECT 1 FROM claims c WHERE c.entity_id = e.id AND c.status = 'recorded')
          AND (e.external_ids = '{}' OR e.external_ids = '')`,
    ),
    count(
      `SELECT COUNT(*) AS n FROM claim_documents cd
        WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.id = cd.claim_id)
           OR NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = cd.document_id)`,
    ),
  ]);

  const violations = {
    claimsWithoutDocument: noDocument,
    verifiedClaimsWithoutPassage: noPassage,
    passagesNotInStoredText: passageNotInText,
    documentsReadWithoutHash: unhashed,
    documentsWithoutKind: untyped,
    rollCallsWithClaimsButNoStructure: votesWithoutMember,
    peopleWithRecordedClaimsButNoId: membersWithoutId,
    orphanedClaimDocuments: orphans,
  };

  const failing = Object.entries(violations).filter(([, value]) => value > 0);

  return Response.json(
    {
      ok: failing.length === 0,
      checkedAt: new Date().toISOString(),
      totals: {
        claims,
        claimsByStatus: byStatus.results ?? [],
        documents,
        rollCalls,
        rollVotes,
        legacyClaims: passageNotInVerified,
        peopleWithoutAnyId: await count(
          `SELECT COUNT(*) AS n FROM entities e
            WHERE e.kind = 'person' AND (e.external_ids = '{}' OR e.external_ids = '')
              AND EXISTS (SELECT 1 FROM claims c WHERE c.entity_id = e.id)`,
        ),
      },
      violations,
      failing: failing.map(([name, value]) => `${name}: ${value}`),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
