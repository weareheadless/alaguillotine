import { getDb } from "@/lib/clock-store";

/**
 * The findings view. Not a register of acts, not a coverage table: rows where a
 * report says a named person was charged, convicted, sentenced or found liable.
 * The name came from the report; the quote is the sentence.
 */

export interface FindingRow {
  claimId: string;
  entityId: string;
  name: string;
  country: string;
  affiliation: string;
  act: string;
  category: string;
  date: string;
  dateKind: "act" | "reported";
  datePrecision: string;
  finding: string;
  status: string;
  confidence: number;
  issuer: string;
  title: string;
  url: string;
  quote: string;
  stance: string;
}

export interface FindingSource {
  name: string;
  n: number;
}

export interface FindingsResult {
  rows: FindingRow[];
  total: number;
  page: number;
  pages: number;
  counts: { findings: number; people: number; sources: number };
  byFinding: Array<{ key: string; n: number }>;
  bySource: FindingSource[];
  person: {
    id: string;
    name: string;
    country: string;
    affiliation: string;
    findings: number;
    sources: number;
  } | null;
}

export interface FindingsQuery {
  q?: string;
  entity?: string;
  finding?: string;
  source?: string;
  page?: number;
}

export async function readFindings(query: FindingsQuery): Promise<FindingsResult | null> {
  const db = await getDb();
  if (!db) return null;

  const per = 30;
  const page = Math.max(1, Number(query.page) || 1);
  const q = (query.q ?? "").trim();
  const entity = (query.entity ?? "").trim();
  const finding = (query.finding ?? "").trim();
  const source = (query.source ?? "").trim();

  const where = ["c.finding != 'none'", "cd.quote != ''"];
  const binds: Array<string | number> = [];
  if (entity) {
    where.push("c.entity_id = ?");
    binds.push(entity);
  } else if (q) {
    where.push("(lower(e.name) LIKE ? OR lower(c.act) LIKE ?)");
    const like = `%${q.toLowerCase()}%`;
    binds.push(like, like);
  }
  if (finding) {
    where.push("c.finding = ?");
    binds.push(finding);
  }
  if (source) {
    where.push("d.issuer = ?");
    binds.push(source);
  }
  const clause = `WHERE ${where.join(" AND ")}`;
  const from = `
    FROM claims c
    JOIN entities e ON e.id = c.entity_id
    JOIN claim_documents cd ON cd.claim_id = c.id
    JOIN documents d ON d.id = cd.document_id`;

  const totalRow = await db
    .prepare(`SELECT COUNT(DISTINCT c.id) AS n ${from} ${clause}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = Number(totalRow?.n ?? 0);

  const rows = await db
    .prepare(
      `SELECT c.id AS claim_id, c.entity_id, c.act, c.category, c.act_date,
              c.finding, c.status, c.confidence, c.date_precision,
              e.name, e.country, e.affiliation,
              d.issuer, d.title, d.url, d.published_at, cd.quote, cd.stance
         ${from} ${clause}
        ORDER BY COALESCE(c.act_date, d.published_at) DESC, c.id
        LIMIT ? OFFSET ?`,
    )
    .bind(...binds, per, (page - 1) * per)
    .all();

  const counts = await db
    .prepare(
      `SELECT
         (SELECT COUNT(DISTINCT c.id) FROM claims c
            JOIN claim_documents cd ON cd.claim_id = c.id
           WHERE c.finding != 'none' AND cd.quote != '') AS findings,
         (SELECT COUNT(DISTINCT c.entity_id) FROM claims c
            JOIN claim_documents cd ON cd.claim_id = c.id
           WHERE c.finding != 'none' AND cd.quote != '') AS people,
         (SELECT COUNT(DISTINCT d.issuer) FROM claims c
            JOIN claim_documents cd ON cd.claim_id = c.id
            JOIN documents d ON d.id = cd.document_id
           WHERE c.finding != 'none' AND cd.quote != '') AS sources`,
    )
    .first<{ findings: number; people: number; sources: number }>();

  const byFinding = await db
    .prepare(
      `SELECT c.finding AS key, COUNT(*) AS n FROM claims c
         JOIN claim_documents cd ON cd.claim_id = c.id
        WHERE c.finding != 'none' AND cd.quote != ''
        GROUP BY c.finding ORDER BY n DESC`,
    )
    .all();

  const bySource = await db
    .prepare(
      `SELECT d.issuer AS name, COUNT(DISTINCT c.id) AS n FROM claims c
         JOIN claim_documents cd ON cd.claim_id = c.id
         JOIN documents d ON d.id = cd.document_id
        WHERE c.finding != 'none' AND cd.quote != ''
        GROUP BY d.issuer ORDER BY n DESC LIMIT 12`,
    )
    .all();

  let person: FindingsResult["person"] = null;
  if (entity) {
    const row = await db
      .prepare("SELECT id, name, country, affiliation FROM entities WHERE id = ? OR slug = ? LIMIT 1")
      .bind(entity, entity)
      .first<Record<string, unknown>>();
    if (row) {
      const tally = await db
        .prepare(
          `SELECT COUNT(DISTINCT c.id) AS findings, COUNT(DISTINCT d.issuer) AS sources
             FROM claims c
             JOIN claim_documents cd ON cd.claim_id = c.id
             JOIN documents d ON d.id = cd.document_id
            WHERE c.entity_id = ? AND c.finding != 'none' AND cd.quote != ''`,
        )
        .bind(String(row.id ?? ""))
        .first<{ findings: number; sources: number }>();
      person = {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        country: String(row.country ?? ""),
        affiliation: String(row.affiliation ?? ""),
        findings: Number(tally?.findings ?? 0),
        sources: Number(tally?.sources ?? 0),
      };
    }
  }

  return {
    rows: (rows.results ?? []).map((raw) => ({
      claimId: String(raw.claim_id ?? ""),
      entityId: String(raw.entity_id ?? ""),
      name: String(raw.name ?? ""),
      country: String(raw.country ?? ""),
      affiliation: String(raw.affiliation ?? ""),
      act: String(raw.act ?? ""),
      category: String(raw.category ?? ""),
      date: String(raw.act_date || raw.published_at || ""),
      dateKind: raw.act_date ? "act" : "reported",
      datePrecision: String(raw.date_precision ?? ""),
      finding: String(raw.finding ?? ""),
      status: String(raw.status ?? ""),
      confidence: Number(raw.confidence ?? 0),
      issuer: String(raw.issuer ?? ""),
      title: String(raw.title ?? ""),
      url: String(raw.url ?? ""),
      quote: String(raw.quote ?? ""),
      stance: String(raw.stance ?? ""),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / per)),
    counts: {
      findings: Number(counts?.findings ?? 0),
      people: Number(counts?.people ?? 0),
      sources: Number(counts?.sources ?? 0),
    },
    byFinding: (byFinding.results ?? []).map((row) => ({
      key: String(row.key ?? ""),
      n: Number(row.n ?? 0),
    })),
    bySource: (bySource.results ?? []).map((row) => ({
      name: String(row.name ?? ""),
      n: Number(row.n ?? 0),
    })),
    person,
  };
}
