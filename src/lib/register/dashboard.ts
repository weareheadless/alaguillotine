import { getDb } from "@/lib/clock-store";

/**
 * One query surface for the register.
 *
 * The register is not a set of reports about itself. It is claims, each with the
 * document that states it and the passage that proves it. This module turns the
 * claim tables into rows a reader can scan, filter and search, and returns the
 * counts that make the result honest: how many claims exist, how many have a
 * passage, and how they split by body.
 *
 * A row is one claim, not one claim-document link: a claim with three sources
 * appears once, showing the strongest passage it has. A vote is a fact about a
 * chamber and is kept out of the default view, because it is not a finding.
 */

export interface ArchiveQuery {
  q?: string;
  body?: string;
  kind?: string;
  category?: string;
  status?: string;
  year?: string;
  page?: number;
}

export interface ArchiveRow {
  claimId: string;
  entityId: string;
  name: string;
  affiliation: string;
  country: string;
  body: string;
  bodyKey: string;
  act: string;
  category: string;
  mechanism: string;
  date: string;
  amount: number | null;
  currency: string;
  confidence: number;
  status: string;
  documentId: string;
  documentKind: string;
  issuer: string;
  title: string;
  number: string;
  url: string;
  publishedAt: string;
  quote: string;
  stance: string;
}

export interface FacetCount {
  key: string;
  label: string;
  n: number;
}

export interface ArchiveFacets {
  claims: number;
  documents: number;
  people: number;
  passages: number;
  bodies: FacetCount[];
  categories: FacetCount[];
  statuses: FacetCount[];
}

export interface ArchiveResult {
  rows: ArchiveRow[];
  total: number;
  page: number;
  pages: number;
  per: number;
  facets: ArchiveFacets;
}

const BODY_LABEL: Record<string, string> = {
  "US-House": "US House",
  "EU-Parliament": "European Parliament",
  "UK-Commons": "UK Commons",
};

export function bodyLabel(key: string): string {
  return BODY_LABEL[key] ?? "Unlisted";
}

export function documentLabel(kind: string): string {
  if (kind === "ptr") return "trade";
  if (kind === "register") return "declaration";
  if (kind === "roll_call") return "vote";
  if (kind === "press") return "report";
  return kind || "record";
}

export function statusLabel(status: string): string {
  if (status === "recorded") return "recorded";
  if (status === "alleged") return "alleged";
  if (status === "matched") return "matched";
  if (status === "legacy") return "unverified";
  return status;
}

const KIND_WHERE: Record<string, string> = {
  trade: "d.kind = 'ptr'",
  declaration: "d.kind = 'register'",
  vote: "d.kind = 'roll_call'",
  report: "d.kind = 'press'",
  unverified: "c.status = 'legacy'",
};

/** The strongest passage first: a finding outranks a record of the same act. */
const STANCE_RANK = `CASE cd.stance
  WHEN 'finds' THEN 0 WHEN 'admits' THEN 1 WHEN 'reports' THEN 2
  WHEN 'records' THEN 3 ELSE 4 END`;

/** D1 returns column names as written; the page reads one fixed shape. */
function toRow(raw: Record<string, unknown>): ArchiveRow {
  const text = (key: string): string => String(raw[key] ?? "");
  const number = Number(raw.amount);
  return {
    claimId: text("claim_id"),
    entityId: text("entity_id"),
    name: text("name"),
    affiliation: text("affiliation"),
    country: text("country"),
    body: bodyLabel(text("body_key")),
    bodyKey: text("body_key"),
    act: text("act"),
    category: text("category"),
    mechanism: text("mechanism"),
    date: text("act_date") || text("published_at"),
    amount: Number.isFinite(number) ? number : null,
    currency: text("currency"),
    confidence: Number(raw.confidence ?? 0),
    status: text("status"),
    documentId: text("document_id"),
    documentKind: text("document_kind"),
    issuer: text("issuer"),
    title: text("title"),
    number: text("number"),
    url: text("url"),
    publishedAt: text("published_at"),
    quote: text("quote"),
    stance: text("stance"),
  };
}

export async function readArchive(query: ArchiveQuery): Promise<ArchiveResult | null> {
  const db = await getDb();
  if (!db) return null;

  const per = 25;
  const page = Math.max(1, Number(query.page) || 1);
  const q = (query.q ?? "").trim();
  const body = (query.body ?? "").trim();
  const kind = (query.kind ?? "").trim();
  const category = (query.category ?? "").trim();
  const status = (query.status ?? "").trim();
  const year = (query.year ?? "").trim();

  const where: string[] = [];
  const binds: Array<string | number> = [];

  if (q) {
    where.push("(lower(e.name) LIKE ? OR lower(c.act) LIKE ?)");
    const like = `%${q.toLowerCase()}%`;
    binds.push(like, like);
  }
  if (body === "unlisted") {
    where.push("u.body_key IS NULL");
  } else if (body) {
    where.push("u.body_key = ?");
    binds.push(body);
  }
  if (category) {
    where.push("c.category = ?");
    binds.push(category);
  }
  if (status) {
    where.push("c.status = ?");
    binds.push(status);
  }
  if (year && /^\d{4}$/.test(year)) {
    where.push("substr(COALESCE(c.act_date, d.published_at), 1, 4) = ?");
    binds.push(year);
  }

  if (kind && KIND_WHERE[kind]) {
    where.push(KIND_WHERE[kind]);
  } else {
    // The default view: acts with a passage, votes excluded. A vote is a fact
    // about the chamber; it belongs in the register but not under "latest".
    where.push(
      "c.status != 'legacy'",
      "d.kind != 'roll_call'",
      "cd.quote != ''",
    );
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = `
    FROM claims c
    JOIN entities e ON e.id = c.entity_id
    LEFT JOIN claim_documents cd ON cd.claim_id = c.id
    LEFT JOIN documents d ON d.id = cd.document_id
    LEFT JOIN universes u ON u.id = (
      SELECT universe_id FROM universe_members WHERE entity_id = c.entity_id LIMIT 1
    )`;

  const totalRow = await db
    .prepare(`SELECT COUNT(DISTINCT c.id) AS n ${from} ${clause}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = Number(totalRow?.n ?? 0);

  const rows = await db
    .prepare(
      `WITH ranked AS (
         SELECT c.id AS claim_id, c.entity_id, c.act, c.category, c.mechanism,
                c.act_date, c.amount, c.currency, c.confidence, c.status,
                e.name, e.affiliation, e.country,
                COALESCE(u.body_key, '') AS body_key,
                d.id AS document_id, d.kind AS document_kind, d.issuer, d.title,
                d.number, d.url, d.published_at,
                cd.quote, cd.stance,
                ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY ${STANCE_RANK}, cd.rowid) AS rn
           ${from} ${clause}
       )
       SELECT * FROM ranked WHERE rn = 1
        ORDER BY COALESCE(act_date, published_at, '') DESC, claim_id
        LIMIT ? OFFSET ?`,
    )
    .bind(...binds, per, (page - 1) * per)
    .all();

  const bodyRows = await db
    .prepare(
      `SELECT COALESCE(u.body_key, '') AS key, COUNT(DISTINCT c.id) AS n
         FROM claims c
         JOIN entities e ON e.id = c.entity_id
         LEFT JOIN universes u ON u.id = (
           SELECT universe_id FROM universe_members WHERE entity_id = c.entity_id LIMIT 1
         )
        GROUP BY key
        ORDER BY n DESC`,
    )
    .all();

  const categoryRows = await db
    .prepare(
      `SELECT category AS key, COUNT(*) AS n FROM claims
        WHERE category != '' GROUP BY category ORDER BY n DESC LIMIT 12`,
    )
    .all();

  const statusRows = await db
    .prepare("SELECT status AS key, COUNT(*) AS n FROM claims GROUP BY status ORDER BY n DESC")
    .all();

  const totals = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM claims) AS claims,
         (SELECT COUNT(*) FROM documents) AS documents,
         (SELECT COUNT(*) FROM entities WHERE kind = 'person') AS people,
         (SELECT COUNT(*) FROM claim_documents WHERE quote != '') AS passages`,
    )
    .first<{ claims: number; documents: number; people: number; passages: number }>();

  const facets: ArchiveFacets = {
    claims: Number(totals?.claims ?? 0),
    documents: Number(totals?.documents ?? 0),
    people: Number(totals?.people ?? 0),
    passages: Number(totals?.passages ?? 0),
    bodies: (bodyRows.results ?? []).map((row) => ({
      key: String(row.key ?? ""),
      label: bodyLabel(String(row.key ?? "")),
      n: Number(row.n ?? 0),
    })),
    categories: (categoryRows.results ?? []).map((row) => ({
      key: String(row.key ?? ""),
      label: String(row.key ?? ""),
      n: Number(row.n ?? 0),
    })),
    statuses: (statusRows.results ?? []).map((row) => ({
      key: String(row.key ?? ""),
      label: statusLabel(String(row.key ?? "")),
      n: Number(row.n ?? 0),
    })),
  };

  return {
    rows: (rows.results ?? []).map((raw) => toRow(raw as Record<string, unknown>)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / per)),
    per,
    facets,
  };
}
