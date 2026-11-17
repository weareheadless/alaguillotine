import { getDb } from "@/lib/clock-store";
import { samePerson } from "@/lib/person-name";

/**
 * The archive: the record behind the line, plus the findings the machine adds.
 *
 * The queue is the cast; this is what each name stands on. A row is an act a
 * source states, not only a conviction. The finding field says how strong the
 * passage is (`found`, `admitted`, `alleged`) and `none` means an act without a
 * finding — the line's wars, trades, crackdowns and appointments.
 *
 * Compliance documents (roll calls, trades, interests) are deliberately out:
 * they were the register's old spine and they are not what this site is about.
 */

export interface ArchiveRow {
  claimId: string;
  entityId: string;
  name: string;
  country: string;
  affiliation: string;
  act: string;
  category: string;
  date: string;
  dateKind: "act" | "reported" | "undated";
  datePrecision: string;
  finding: string;
  status: string;
  confidence: number;
  issuer: string;
  title: string;
  url: string;
  quote: string;
  stance: string;
  inLine: boolean;
  /** The queue's slug, when the name is in the line: the one page it has. */
  lineSlug: string;
}

export interface ArchiveSource {
  name: string;
  n: number;
}

export interface ArchiveResult {
  rows: ArchiveRow[];
  total: number;
  page: number;
  pages: number;
  counts: { acts: number; people: number; sources: number; line: number; fresh: number };
  byFinding: Array<{ key: string; n: number }>;
  byCategory: Array<{ key: string; n: number }>;
  bySource: ArchiveSource[];
  person: {
    id: string;
    name: string;
    slug: string;
    country: string;
    affiliation: string;
    findings: number;
    sources: number;
    /** Standing in the line — the only names that get a person page. */
    inLine: boolean;
  } | null;
}

export interface ArchiveQuery {
  q?: string;
  entity?: string;
  finding?: string;
  source?: string;
  line?: string;
  focus?: string;
  fresh?: string;
  page?: number;
}

const PRESS = "d.kind = 'press' AND c.status != 'retracted'";

export async function readArchive(query: ArchiveQuery): Promise<ArchiveResult | null> {
  const db = await getDb();
  if (!db) return null;

  const per = 30;
  const page = Math.max(1, Number(query.page) || 1);
  const q = (query.q ?? "").trim();
  const entity = (query.entity ?? "").trim();
  const finding = (query.finding ?? "").trim();
  const source = (query.source ?? "").trim();
  const line = (query.line ?? "") === "1";
  const focus = (query.focus ?? "").trim();
  const fresh = (query.fresh ?? "") === "1";

  const where = [PRESS];
  const binds: Array<string | number> = [];
  if (entity) {
    where.push("c.entity_id = ?");
    binds.push(entity);
  } else if (q) {
    where.push("(lower(e.name) LIKE ? OR lower(c.act) LIKE ?)");
    const like = `%${q.toLowerCase()}%`;
    binds.push(like, like);
  }
  if (finding === "act") {
    where.push("c.finding = 'none'");
  } else if (finding) {
    where.push("c.finding = ?");
    binds.push(finding);
  }
  if (source) {
    where.push("d.issuer = ?");
    binds.push(source);
  }
  if (line) {
    where.push(
      "EXISTS (SELECT 1 FROM queue_people qp WHERE lower(qp.name) = lower(e.name))",
    );
  }
  if (fresh) {
    // A name the discovery pass put in the line. The queue row is the mark:
    // every person discovery added is source 'discovery', and the name pass
    // then reads them like any other. This is the machine's intake, not the
    // leftovers of the conviction search.
    where.push(
      "EXISTS (SELECT 1 FROM queue_people qp WHERE lower(qp.name) = lower(e.name) AND qp.source = 'discovery')",
    );
  }
  const baseClause = `WHERE ${where.join(" AND ")}`;
  const from = `FROM claims c
    JOIN entities e ON e.id = c.entity_id
    JOIN documents d ON d.id = c.document_id`;

  // The focus is a reading of the categories, not a new population: money,
  // influence, war and repression are the four ways power is used.
  const FOCUS: Record<string, string[]> = {
    money: ["finance", "extraction", "labour", "climate"],
    influence: ["impunity", "media"],
    war: ["war", "arms", "genocide"],
    repression: ["repression", "migration"],
  };
  const focusCats = FOCUS[focus] ?? [];
  if (focusCats.length) {
    where.push(`c.category IN (${focusCats.map(() => "?").join(", ")})`);
    for (const category of focusCats) binds.push(category);
  }
  const clause = `WHERE ${where.join(" AND ")}`;

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n ${from} ${clause}`)
    .bind(...binds)
    .first<{ n: number }>();
  const total = Number(totalRow?.n ?? 0);

  const rows = await db
    .prepare(
      `SELECT c.id AS claim_id, c.entity_id, c.act, c.category, c.act_date,
              c.date_precision, c.finding, c.status, c.confidence,
              e.name, e.country, e.affiliation,
              d.issuer, d.title, d.url, d.published_at, c.quote, '' AS stance
         ${from} ${clause}
        ORDER BY COALESCE(c.act_date, d.published_at, c.created_at) DESC, c.id
        LIMIT ? OFFSET ?`,
    )
    .bind(...binds, per, (page - 1) * per)
    .all();

  const counts = await db
    .prepare(
      `SELECT COUNT(*) AS acts,
              COUNT(DISTINCT c.entity_id) AS people,
              COUNT(DISTINCT d.issuer) AS sources,
              COUNT(DISTINCT CASE WHEN EXISTS (
                SELECT 1 FROM queue_people qp WHERE lower(qp.name) = lower(e.name)
              ) THEN c.entity_id END) AS line,
              COUNT(DISTINCT CASE WHEN EXISTS (
                SELECT 1 FROM queue_people qp
                 WHERE lower(qp.name) = lower(e.name) AND qp.source = 'discovery'
              ) THEN c.entity_id END) AS fresh
         ${from} ${clause}`,
    )
    .bind(...binds)
    .first<{ acts: number; people: number; sources: number; line: number; fresh: number }>();

  const byFinding = await db
    .prepare(
      `SELECT c.finding AS key, COUNT(*) AS n ${from} ${baseClause}
        GROUP BY c.finding ORDER BY n DESC`,
    )
    .bind(...binds.slice(0, binds.length - focusCats.length))
    .all();

  const byCategory = await db
    .prepare(
      `SELECT c.category AS key, COUNT(*) AS n ${from} ${baseClause}
        GROUP BY c.category ORDER BY n DESC`,
    )
    .bind(...binds.slice(0, binds.length - focusCats.length))
    .all();

  const bySource = await db
    .prepare(
      `SELECT d.issuer AS name, COUNT(DISTINCT c.id) AS n ${from}
        WHERE ${PRESS} AND d.issuer != ''
        GROUP BY d.issuer ORDER BY n DESC LIMIT 12`,
    )
    .all();

  // The line is the queue, not a second population. The archive asks it one
  // question: does this name have a page, and therefore a link? The comparison
  // is the person matcher, not lower-case equality, so a finding that spells a
  // line name longer is still the same name.
  const queue = await db.prepare("SELECT slug, name FROM queue_people").all();
  const lineFor = (name: string): { inLine: boolean; slug: string } => {
    const hit = (queue.results ?? []).find(
      (row) => row.name && samePerson(String(row.name), name),
    );
    return { inLine: Boolean(hit), slug: hit?.slug ? String(hit.slug) : "" };
  };

  let person: ArchiveResult["person"] = null;
  if (entity) {
    const row = await db
      .prepare("SELECT id, name, slug, country, affiliation FROM entities WHERE id = ? OR slug = ? LIMIT 1")
      .bind(entity, entity)
      .first<Record<string, unknown>>();
    if (row) {
      const tally = await db
        .prepare(
          `SELECT COUNT(DISTINCT c.id) AS findings, COUNT(DISTINCT d.issuer) AS sources
             FROM claims c JOIN documents d ON d.id = c.document_id
            WHERE c.entity_id = ? AND ${PRESS} AND c.finding != 'none' AND c.quote != ''`,
        )
        .bind(String(row.id ?? ""))
        .first<{ findings: number; sources: number }>();
      const line = lineFor(String(row.name ?? ""));
      person = {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        slug: String(row.slug ?? ""),
        country: String(row.country ?? ""),
        affiliation: String(row.affiliation ?? ""),
        findings: Number(tally?.findings ?? 0),
        sources: Number(tally?.sources ?? 0),
        inLine: line.inLine,
      };
    }
  }

  return {
    rows: (rows.results ?? []).map((raw) => {
      const actDate = String(raw.act_date ?? "");
      const published = String(raw.published_at ?? "");
      const line = lineFor(String(raw.name ?? ""));
      return {
        claimId: String(raw.claim_id ?? ""),
        entityId: String(raw.entity_id ?? ""),
        name: String(raw.name ?? ""),
        country: String(raw.country ?? ""),
        affiliation: String(raw.affiliation ?? ""),
        act: String(raw.act ?? ""),
        category: String(raw.category ?? ""),
        date: actDate || published,
        dateKind: actDate ? "act" : published ? "reported" : "undated",
        datePrecision: String(raw.date_precision ?? ""),
        finding: String(raw.finding ?? "none"),
        status: String(raw.status ?? ""),
        confidence: Number(raw.confidence ?? 0),
        issuer: String(raw.issuer ?? ""),
        title: String(raw.title ?? ""),
        url: String(raw.url ?? ""),
        quote: String(raw.quote ?? ""),
        stance: String(raw.stance ?? ""),
        inLine: line.inLine,
        lineSlug: line.slug,
      };
    }),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / per)),
    counts: {
      acts: Number(counts?.acts ?? 0),
      people: Number(counts?.people ?? 0),
      sources: Number(counts?.sources ?? 0),
      line: Number(counts?.line ?? 0),
      fresh: Number(counts?.fresh ?? 0),
    },
    byFinding: (byFinding.results ?? []).map((row) => ({
      key: String(row.key ?? ""),
      n: Number(row.n ?? 0),
    })),
    byCategory: (byCategory.results ?? []).map((row) => ({
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
