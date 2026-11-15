import { getDb } from "@/lib/clock-store";

/**
 * Coverage: the one number the site can publish about itself without arguing.
 *
 * Every claim on this site is a statement about a person, so the honest
 * question is not "how many claims" but "how many of the people in the declared
 * population can we say anything about, and on what". That needs a denominator
 * written down before the counting, which is what `universes` is for.
 *
 * Two ratios, deliberately separate:
 *
 *   read      — the person appears in a document we have read, with a passage
 *               stored. For a member of the House this is usually a vote.
 *   covered   — the person has a stored passage about conduct, from a document
 *               that is not a roll call. A vote is a fact about the chamber,
 *               not evidence of anything, so it does not count here.
 *
 * Reporting one number instead of two would flatter the register. A vote file
 * read across 20 roll calls touches almost everyone and documents nothing about
 * anyone.
 */

const GROUNDED = `c.status NOT IN ('legacy', 'refuted')`;

export interface UniverseCoverage {
  id: string;
  name: string;
  description: string;
  expected: number;
  listed: number;
  read: number;
  covered: number;
  declaredAt: string;
  sourceUrl: string;
}

export interface PartyCoverage {
  party: string;
  listed: number;
  read: number;
  covered: number;
}

export interface CoverageReport {
  universes: UniverseCoverage[];
  parties: PartyCoverage[];
  record: {
    claims: number;
    byStatus: Array<{ status: string; n: number }>;
    documents: Array<{ kind: string; n: number; withText: number }>;
    groundedClaims: number;
    people: number;
    peopleWithPassage: number;
  } | null;
}

const PARTY_NAME: Record<string, string> = {
  R: "Republican",
  D: "Democratic",
  I: "Independent",
  ID: "Independent",
};

export function partyLabel(code: string): string {
  return PARTY_NAME[code] ?? code ?? "unknown";
}

export async function readCoverage(): Promise<CoverageReport | null> {
  const db = await getDb();
  if (!db) return null;

  const universes = await db
    .prepare(
      `SELECT u.id, u.name, u.description, u.expected, u.declared_at, u.source_url,
              COUNT(m.entity_id) AS listed,
              SUM(CASE WHEN m.status = 'covered' THEN 1 ELSE 0 END) AS covered
         FROM universes u
         LEFT JOIN universe_members m ON m.universe_id = u.id
        GROUP BY u.id
        ORDER BY u.declared_at DESC`,
    )
    .all();

  const read = await db
    .prepare(
      `SELECT m.universe_id AS id, COUNT(DISTINCT m.entity_id) AS n
         FROM universe_members m
         JOIN claims c ON c.entity_id = m.entity_id
         JOIN claim_documents cd ON cd.claim_id = c.id
         JOIN documents d ON d.id = cd.document_id
        WHERE cd.quote != '' AND ${GROUNDED}
        GROUP BY m.universe_id`,
    )
    .all();
  const readBy = new Map(
    (read.results ?? []).map((r) => [String(r.id), Number(r.n ?? 0)]),
  );

  const parties = await db
    .prepare(
      `SELECT coalesce(nullif(e.affiliation, ''), 'unknown') AS party,
              COUNT(*) AS listed,
              SUM(CASE WHEN m.status = 'covered' THEN 1 ELSE 0 END) AS covered,
              SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM claims c
                      JOIN claim_documents cd ON cd.claim_id = c.id
                      JOIN documents d ON d.id = cd.document_id
                     WHERE c.entity_id = e.id AND cd.quote != '' AND ${GROUNDED})
                  THEN 1 ELSE 0 END) AS read
         FROM universe_members m
         JOIN entities e ON e.id = m.entity_id
        GROUP BY party
        ORDER BY listed DESC`,
    )
    .all();

  const statuses = await db
    .prepare("SELECT status, COUNT(*) AS n FROM claims GROUP BY status ORDER BY n DESC")
    .all();

  const documents = await db
    .prepare(
      `SELECT kind, COUNT(*) AS n,
              SUM(CASE WHEN text_excerpt != '' THEN 1 ELSE 0 END) AS withText
         FROM documents GROUP BY kind ORDER BY n DESC`,
    )
    .all();

  const record = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM claims) AS claims,
              (SELECT COUNT(*) FROM entities WHERE kind = 'person') AS people,
              (SELECT COUNT(DISTINCT c.entity_id) FROM claims c
                 JOIN claim_documents cd ON cd.claim_id = c.id
                WHERE cd.quote != '' AND ${GROUNDED}) AS peopleWithPassage,
              (SELECT COUNT(*) FROM claims c
                 JOIN claim_documents cd ON cd.claim_id = c.id
                WHERE cd.quote != '' AND ${GROUNDED}) AS groundedClaims`,
    )
    .first<Record<string, unknown>>();

  return {
    universes: (universes.results ?? []).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      description: String(row.description ?? ""),
      expected: Number(row.expected ?? 0),
      listed: Number(row.listed ?? 0),
      read: readBy.get(String(row.id)) ?? 0,
      covered: Number(row.covered ?? 0),
      declaredAt: String(row.declared_at ?? ""),
      sourceUrl: String(row.source_url ?? ""),
    })),
    parties: (parties.results ?? []).map((row) => ({
      party: String(row.party ?? "unknown"),
      listed: Number(row.listed ?? 0),
      read: Number(row.read ?? 0),
      covered: Number(row.covered ?? 0),
    })),
    record: record
      ? {
          claims: Number(record.claims ?? 0),
          people: Number(record.people ?? 0),
          peopleWithPassage: Number(record.peopleWithPassage ?? 0),
          groundedClaims: Number(record.groundedClaims ?? 0),
          byStatus: (statuses.results ?? []).map((r) => ({
            status: String(r.status ?? ""),
            n: Number(r.n ?? 0),
          })),
          documents: (documents.results ?? []).map((r) => ({
            kind: String(r.kind ?? ""),
            n: Number(r.n ?? 0),
            withText: Number(r.withText ?? 0),
          })),
        }
      : null,
  };
}
