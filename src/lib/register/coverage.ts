import { getDb } from "@/lib/clock-store";

/**
 * Coverage: the one number the site can publish about itself without arguing.
 *
 * Every claim on this site is a statement about a person, so the honest
 * question is not "how many claims" but "how many of the people in the declared
 * population can we say anything about, and on what". That needs a denominator
 * written down before the counting, which is what `universes` is for.
 *
 * There is no single denominator. A member of the US House and a Member of the
 * European Parliament belong to different populations with different documents,
 * different rules and different gaps. Their numbers are reported separately and
 * never added: a combined ratio would describe a body that does not exist.
 *
 * Three ratios, deliberately separate:
 *
 *   read       — the person appears in a document we have read, with a passage
 *                stored. For a member of the House this is usually a vote.
 *   documented — the person has a stored passage about conduct, from a document
 *                that is not a roll call. A vote is a fact about the chamber,
 *                not evidence of anything, so it does not count here.
 *   accused    — the passage is about a misdeed, from journalism or a register.
 *
 * Reporting one number instead of three would flatter the register. A vote file
 * read across a parliament touches almost everyone and documents nothing about
 * anyone.
 */

const GROUNDED = `c.status NOT IN ('legacy', 'refuted', 'alleged')`;

export interface UniverseCoverage {
  id: string;
  name: string;
  description: string;
  country: string;
  body: string;
  bodyKey: string;
  expected: number;
  listed: number;
  read: number;
  documented: number;
  accused: number;
  declaredAt: string;
  sourceUrl: string;
  parties: PartyCoverage[];
}

export interface PartyCoverage {
  party: string;
  listed: number;
  read: number;
  documented: number;
  accused: number;
}

export interface CoverageReport {
  universes: UniverseCoverage[];
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
  PPE: "European People's Party",
  "S&D": "Socialists and Democrats",
  PfE: "Patriots for Europe",
  ECR: "European Conservatives and Reformists",
  Renew: "Renew Europe",
  "Verts/ALE": "Greens/European Free Alliance",
  "The Left": "The Left",
  ESN: "Europe of Sovereign Nations",
  NI: "Non-attached",
};

export function partyLabel(code: string): string {
  return PARTY_NAME[code] ?? code ?? "unknown";
}

/** The label for a body, with its country when it has one. */
export function bodyLabel(universe: Pick<UniverseCoverage, "country" | "body">): string {
  return universe.country ? `${universe.country} · ${universe.body}` : universe.body;
}

export async function readCoverage(): Promise<CoverageReport | null> {
  const db = await getDb();
  if (!db) return null;

  const universes = await db
    .prepare(
      `SELECT c.*, u.description, u.source_url, u.country, u.body, u.body_key
         FROM coverage c
         JOIN universes u ON u.id = c.universe_id
        ORDER BY c.declared_at DESC`,
    )
    .all();

  const parties = await db
    .prepare(
      `SELECT m.universe_id,
              coalesce(nullif(e.affiliation, ''), 'unknown') AS party,
              COUNT(*) AS listed,
              SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM claims c
                      JOIN claim_documents cd ON cd.claim_id = c.id
                      JOIN documents d ON d.id = cd.document_id
                     WHERE c.entity_id = e.id AND cd.quote != '' AND ${GROUNDED})
                  THEN 1 ELSE 0 END) AS read,
              SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM claims c
                      JOIN claim_documents cd ON cd.claim_id = c.id
                      JOIN documents d ON d.id = cd.document_id
                     WHERE c.entity_id = e.id AND cd.quote != '' AND ${GROUNDED}
                       AND d.kind != 'roll_call')
                  THEN 1 ELSE 0 END) AS documented,
              SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM claims c
                      JOIN claim_documents cd ON cd.claim_id = c.id
                      JOIN documents d ON d.id = cd.document_id
                     WHERE c.entity_id = e.id AND cd.quote != '' AND ${GROUNDED}
                       AND d.kind IN ('press', 'register'))
                  THEN 1 ELSE 0 END) AS accused
         FROM universe_members m
         JOIN entities e ON e.id = m.entity_id
        WHERE m.status != 'excluded'
        GROUP BY m.universe_id, party
        ORDER BY listed DESC`,
    )
    .all();

  const byUniverse = new Map<string, PartyCoverage[]>();
  for (const row of parties.results ?? []) {
    const id = String(row.universe_id ?? "");
    byUniverse.set(id, [
      ...(byUniverse.get(id) ?? []),
      {
        party: String(row.party ?? "unknown"),
        listed: Number(row.listed ?? 0),
        read: Number(row.read ?? 0),
        documented: Number(row.documented ?? 0),
        accused: Number(row.accused ?? 0),
      },
    ]);
  }

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
    universes: (universes.results ?? []).map((row) => {
      const id = String(row.universe_id ?? "");
      return {
        id,
        name: String(row.name ?? ""),
        description: String(row.description ?? ""),
        country: String(row.country ?? ""),
        body: String(row.body ?? ""),
        bodyKey: String(row.body_key ?? ""),
        expected: Number(row.expected ?? 0),
        listed: Number(row.listed ?? 0),
        read: Number(row.read ?? 0),
        documented: Number(row.documented ?? 0),
        accused: Number(row.accused ?? 0),
        declaredAt: String(row.declared_at ?? ""),
        sourceUrl: String(row.source_url ?? ""),
        parties: byUniverse.get(id) ?? [],
      };
    }),
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
