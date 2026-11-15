import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * GET /api/register/claims — read a person back out of the register.
 *
 * This is the query surface the architecture promises: every claim with the
 * document under it, the stance that document holds, the passage, and the basis
 * for the confidence. If a claim cannot be read this way it does not belong in
 * the register yet, which is why `legacy` rows come back labelled rather than
 * filtered out.
 *
 *   ?entity=<bioguide | slug | exact name>
 *   &status=recorded,found        &category=war
 *   &from=2024-01-01 &to=2024-12-31
 *   &minConfidence=0.5 &limit=100 &offset=0
 *
 * `?entity=` also accepts an external id, because that is how a filing names a
 * person when it has never heard of our slugs.
 *
 * Writes nothing. Safe to call from the site, the admin panel and the dispatch
 * pipeline alike.
 */

interface EntityRow {
  id: string;
  kind: string;
  name: string;
  slug: string;
  aliases: string;
  affiliation: string;
  role: string;
  external_ids: string;
}

interface ClaimRow {
  id: string;
  act: string;
  category: string;
  mechanism: string;
  beneficiary: string;
  act_date: string | null;
  date_precision: string;
  amount: number | null;
  currency: string;
  status: string;
  confidence: number;
  confidence_basis: string;
  legacy_id: string | null;
}

interface SourceRow {
  claim_id: string;
  document_id: string;
  quote: string;
  locator: string;
  stance: string;
  kind: string;
  issuer: string;
  title: string;
  number: string;
  url: string;
  published_at: string;
  has_text: number;
}

const STATUS_ORDER = [
  "recorded",
  "found",
  "admitted",
  "reported",
  "alleged",
  "matched",
  "legacy",
  "refuted",
  "superseded",
];

function parseList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

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

  const params = new URL(request.url).searchParams;
  const who = (params.get("entity") ?? "").trim();
  if (!who) {
    return Response.json(
      { error: "entity is required: a bioguide id, a slug or an exact name" },
      { status: 400 },
    );
  }

  const found = await db
    .prepare(
      `SELECT id, kind, name, slug, aliases, affiliation, role, external_ids
         FROM entities
        WHERE id = ? OR slug = ? OR lower(name) = lower(?)
           OR json_extract(external_ids, '$.bioguide') = ?
        LIMIT 2`,
    )
    .bind(who, who, who, who)
    .all();

  const rows = (found.results ?? []) as unknown as EntityRow[];
  if (!rows.length) {
    return Response.json({ error: "no such entity", entity: who }, { status: 404 });
  }
  if (rows.length > 1) {
    // Two entities and one name is a merge question, not a query result.
    return Response.json(
      { error: "ambiguous entity", candidates: rows.map((r) => ({ id: r.id, name: r.name })) },
      { status: 409 },
    );
  }
  const entity = rows[0];

  const statuses = parseList(params.get("status"));
  const categories = parseList(params.get("category"));
  const from = (params.get("from") ?? "").trim();
  const to = (params.get("to") ?? "").trim();
  const minConfidence = Number(params.get("minConfidence") ?? 0) || 0;
  const limit = Math.max(1, Math.min(500, Number(params.get("limit") ?? 100) || 100));
  const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);

  const where = ["c.entity_id = ?"];
  const bind: unknown[] = [entity.id];
  if (statuses.length) {
    where.push(`lower(c.status) IN (${statuses.map(() => "?").join(", ")})`);
    bind.push(...statuses);
  }
  if (categories.length) {
    where.push(`lower(c.category) IN (${categories.map(() => "?").join(", ")})`);
    bind.push(...categories);
  }
  if (from) {
    where.push("c.act_date >= ?");
    bind.push(from);
  }
  if (to) {
    where.push("c.act_date <= ?");
    bind.push(to);
  }
  if (minConfidence > 0) {
    where.push("c.confidence >= ?");
    bind.push(minConfidence);
  }

  const claims = await db
    .prepare(
      `SELECT c.id, c.act, c.category, c.mechanism, c.beneficiary, c.act_date,
              c.date_precision, c.amount, c.currency, c.status, c.confidence,
              c.confidence_basis, c.legacy_id
         FROM claims c
        WHERE ${where.join(" AND ")}
        ORDER BY c.act_date DESC, c.confidence DESC, c.id
        LIMIT ? OFFSET ?`,
    )
    .bind(...bind, limit, offset)
    .all();

  const claimRows = (claims.results ?? []) as unknown as ClaimRow[];
  const ids = claimRows.map((c) => c.id);

  let sources: SourceRow[] = [];
  if (ids.length) {
    const got = await db
      .prepare(
        `SELECT cd.claim_id, cd.document_id, cd.quote, cd.locator, cd.stance,
                d.kind, d.issuer, d.title, d.number, d.url, d.published_at,
                CASE WHEN d.text_excerpt != '' THEN 1 ELSE 0 END AS has_text
           FROM claim_documents cd
           JOIN documents d ON d.id = cd.document_id
          WHERE cd.claim_id IN (${ids.map(() => "?").join(", ")})
          ORDER BY CASE WHEN cd.quote != '' THEN 0 ELSE 1 END, d.published_at DESC`,
      )
      .bind(...ids)
      .all();
    sources = (got.results ?? []) as unknown as SourceRow[];
  }

  const byClaim = new Map<string, SourceRow[]>();
  for (const source of sources) {
    byClaim.set(source.claim_id, [...(byClaim.get(source.claim_id) ?? []), source]);
  }

  const rowsOut = claimRows.map((claim) => ({
    id: claim.id,
    act: claim.act,
    category: claim.category,
    mechanism: claim.mechanism,
    beneficiary: claim.beneficiary,
    date: claim.act_date,
    datePrecision: claim.date_precision,
    amount: claim.amount,
    currency: claim.currency,
    status: claim.status,
    confidence: claim.confidence,
    basis: claim.confidence_basis,
    legacyId: claim.legacy_id,
    // True when at least one source carries a passage the reader can check.
    sourced: (byClaim.get(claim.id) ?? []).some((s) => s.quote !== ""),
    sources: (byClaim.get(claim.id) ?? []).map((s) => ({
      document: s.document_id,
      kind: s.kind,
      issuer: s.issuer,
      title: s.title,
      number: s.number,
      date: s.published_at,
      url: s.url,
      stance: s.stance,
      quote: s.quote,
      locator: s.locator,
      stored: s.has_text === 1,
    })),
  }));

  // The shape of the record, so a reader can see what is solid before reading.
  const tally = await db
    .prepare(
      `SELECT status, category, COUNT(*) AS n
         FROM claims WHERE entity_id = ?
        GROUP BY status, category`,
    )
    .bind(entity.id)
    .all<{ results?: Array<Record<string, unknown>> }>();

  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const row of tally.results ?? []) {
    const status = String(row.status ?? "");
    const category = String(row.category ?? "") || "uncategorised";
    const n = Number(row.n ?? 0);
    statusCounts[status] = (statusCounts[status] ?? 0) + n;
    categoryCounts[category] = (categoryCounts[category] ?? 0) + n;
  }

  const ranked = Object.entries(statusCounts).sort(
    ([a], [b]) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b),
  );

  return Response.json(
    {
      ok: true,
      entity: {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        kind: entity.kind,
        party: entity.affiliation,
        role: entity.role,
        aliases: JSON.parse(entity.aliases || "[]"),
        ids: JSON.parse(entity.external_ids || "{}"),
      },
      record: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        byStatus: Object.fromEntries(ranked),
        byCategory: categoryCounts,
      },
      filters: { statuses, categories, from, to, minConfidence, limit, offset },
      returned: rowsOut.length,
      claims: rowsOut,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
