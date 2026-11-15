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
 *
 * The checks run one after another. They were once a Promise.all, which was
 * faster until the register grew past fifty thousand claims and sixteen
 * simultaneous scans started returning 500s. An invariant you cannot read is
 * not an invariant.
 */

// `matched` belongs here. It was left out of this list, which is why the audit
// reported zero violations while 125 matched claims had passages that could not
// be found in their own document.
const VERIFIED = "('recorded','matched','reported','found','admitted')";

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

  try {
    const claims = await count("SELECT COUNT(*) AS n FROM claims");
    const byStatus = await db
      .prepare("SELECT status, COUNT(*) AS n FROM claims GROUP BY status ORDER BY n DESC")
      .all<{ results?: Array<Record<string, unknown>> }>();

    const noDocument = await count(
      `SELECT COUNT(*) AS n FROM claims c
        WHERE NOT EXISTS (SELECT 1 FROM claim_documents cd WHERE cd.claim_id = c.id)`,
    );

    // A verified claim with no passage is the failure the register exists to
    // prevent: a sentence with nothing under it.
    const noPassage = await count(
      `SELECT COUNT(*) AS n FROM claims c
        WHERE c.status IN ${VERIFIED}
          AND NOT EXISTS (
            SELECT 1 FROM claim_documents cd
             WHERE cd.claim_id = c.id AND cd.quote != '')`,
    );

    // The passage must be in the text we stored, not merely in the text we saw.
    const passageNotInText = await count(
      `SELECT COUNT(*) AS n FROM claims c
          JOIN claim_documents cd ON cd.claim_id = c.id
          JOIN documents d ON d.id = cd.document_id
        WHERE c.status IN ${VERIFIED}
          AND cd.quote != ''
          AND instr(d.text_excerpt, cd.quote) = 0`,
    );

    const passageNotInVerified = await count("SELECT COUNT(*) AS n FROM claims WHERE status = 'legacy'");
    const documents = await count("SELECT COUNT(*) AS n FROM documents");
    const unhashed = await count(
      "SELECT COUNT(*) AS n FROM documents WHERE text_excerpt != '' AND content_hash = ''",
    );
    const untyped = await count("SELECT COUNT(*) AS n FROM documents WHERE kind = ''");
    const rollCalls = await count("SELECT COUNT(*) AS n FROM roll_calls");
    const rollVotes = await count("SELECT COUNT(*) AS n FROM roll_votes");

    // A roll-call document with claims but no parsed structure cannot have
    // grounded them.
    const votesWithoutMember = await count(
      `SELECT COUNT(*) AS n FROM documents d
        WHERE d.kind = 'roll_call'
          AND EXISTS (SELECT 1 FROM claim_documents cd WHERE cd.document_id = d.id)
          AND NOT EXISTS (SELECT 1 FROM roll_calls rc WHERE rc.document_id = d.id)`,
    );

    // Only votes bind an identity: a roll call names a bioguide id, so a
    // recorded vote without one means the join is broken. A person known only
    // from journalism has no number yet, and that is a coverage gap, not a
    // violation.
    const membersWithoutId = await count(
      `SELECT COUNT(*) AS n FROM entities e
        WHERE e.kind = 'person'
          AND EXISTS (SELECT 1 FROM claims c WHERE c.entity_id = e.id AND c.status = 'recorded')
          AND (e.external_ids = '{}' OR e.external_ids = '')`,
    );

    const orphans = await count(
      `SELECT COUNT(*) AS n FROM claim_documents cd
        WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.id = cd.claim_id)
           OR NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = cd.document_id)`,
    );

    // A byline, a reading time or a login prompt stored as the passage.
    const furniture = await count(
      `SELECT COUNT(*) AS n FROM claims c
          JOIN claim_documents cd ON cd.claim_id = c.id
        WHERE c.status IN ${VERIFIED}
          AND (cd.quote LIKE 'Credit:%' OR cd.quote LIKE 'Published %'
               OR cd.quote LIKE 'Updated %' OR cd.quote LIKE 'By %'
               OR cd.quote LIKE 'Log in%' OR cd.quote LIKE 'Sign in%'
               OR cd.quote LIKE '% min read%')`,
    );

    // A trade whose claim was deleted is a row pointing at nothing.
    const danglingTrades = await count(
      `SELECT COUNT(*) AS n FROM ptr_transactions t
        WHERE t.claim_id != ''
          AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.id = t.claim_id)`,
    );

    const peopleWithoutAnyId = await count(
      `SELECT COUNT(*) AS n FROM entities e
        WHERE e.kind = 'person' AND (e.external_ids = '{}' OR e.external_ids = '')
          AND EXISTS (SELECT 1 FROM claims c WHERE c.entity_id = e.id)`,
    );

  const violations = {
    claimsWithoutDocument: noDocument,
    verifiedClaimsWithoutPassage: noPassage,
    passagesNotInStoredText: passageNotInText,
    documentsReadWithoutHash: unhashed,
    documentsWithoutKind: untyped,
    rollCallsWithClaimsButNoStructure: votesWithoutMember,
    peopleWithRecordedClaimsButNoId: membersWithoutId,
    orphanedClaimDocuments: orphans,
    furniturePassages: furniture,
    tradesPointingAtMissingClaims: danglingTrades,
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
        peopleWithoutAnyId,
      },
      violations,
      failing: failing.map(([name, value]) => `${name}: ${value}`),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  } catch (error) {
    return Response.json(
      { ok: false, error: String(error), checkedAt: new Date().toISOString() },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
