/**
 * The gate for the figures.
 *
 * Claims always had a reviewer; the numbers did not, and the positions join
 * found what that meant: a projected 14 million deaths filed as a toll, a
 * country's air-pollution mortality filed against a prime minister, a
 * company's profit filed as if it were the chief executive's money. None of
 * them had ever been looked at by a person.
 *
 * A number now waits like a claim does. Nothing pending is shown on a page.
 */

export type NumberStatus = "pending" | "accepted" | "rejected" | "legacy";

export interface NumberRow {
  slug: string;
  person: string;
  kind: string;
  label: string;
  display: string;
  year: number | null;
  value: number | null;
  unit: string;
  sourceUrl: string;
  evidenceQuote: string;
  confidence: number;
  qualifier: string;
  whose: string;
  grade: string;
  gradeBasis: string;
  reviewStatus: NumberStatus;
}

type Result = { results?: Array<Record<string, unknown>> };

type Statement = {
  bind: (...v: unknown[]) => Statement;
  run: () => Promise<unknown>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Result>() => Promise<T>;
};

export type NumbersDb = { prepare: (q: string) => Statement };

const rowFromDb = (r: Record<string, unknown>): NumberRow => ({
  slug: String(r.slug ?? ""),
  person: String(r.person ?? r.slug ?? ""),
  kind: String(r.kind ?? ""),
  label: String(r.label ?? ""),
  display: String(r.display ?? ""),
  year: r.year == null ? null : Number(r.year),
  value: r.value == null ? null : Number(r.value),
  unit: String(r.unit ?? ""),
  sourceUrl: String(r.source_url ?? ""),
  evidenceQuote: String(r.evidence_quote ?? ""),
  confidence: Number(r.confidence ?? 0),
  qualifier: String(r.qualifier ?? ""),
  whose: String(r.whose ?? ""),
  grade: String(r.evidence_grade ?? ""),
  gradeBasis: String(r.grade_basis ?? ""),
  reviewStatus: String(r.review_status ?? "legacy") as NumberStatus,
});

export async function listNumbers(
  db: NumbersDb,
  opts: { status?: NumberStatus | "all"; limit?: number } = {},
): Promise<NumberRow[]> {
  const status = opts.status ?? "pending";
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  const where = status === "all" ? "" : "WHERE review_status = ?";
  const rows = await db
    .prepare(
      `SELECT * FROM person_numbers ${where}
        ORDER BY confidence DESC, slug, kind LIMIT ${limit}`,
    )
    .bind(...(status === "all" ? [] : [status]))
    .all();
  return (rows.results ?? []).map(rowFromDb);
}

export async function numberCounts(db: NumbersDb): Promise<Record<string, number>> {
  const rows = await db
    .prepare("SELECT review_status AS s, COUNT(*) AS n FROM person_numbers GROUP BY s")
    .bind()
    .all();
  const out: Record<string, number> = {};
  for (const r of rows.results ?? []) out[String(r.s ?? "")] = Number(r.n ?? 0);
  return out;
}

const QUALIFIERS = [ "", "recorded", "attributed", "projected", "estimate" ];
const WHOSE = [ "", "person", "firm", "fund", "state" ];
const GRADES = [ "", "A", "B", "C", "D" ];

/**
 * Accept, reject or hold one figure.
 *
 * A and B need a written basis, exactly as claims do — the standard does not
 * get softer because the thing being graded is a number.
 */
export async function reviewNumber(
  db: NumbersDb,
  input: {
    slug: string;
    kind: string;
    label: string;
    status: NumberStatus;
    qualifier?: string;
    whose?: string;
    grade?: string;
    basis?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!["accepted", "rejected", "pending"].includes(input.status)) {
    return { ok: false, error: "unknown status" };
  }
  if (input.status === "rejected" && !String(input.basis ?? "").trim()) {
    return { ok: false, error: "a rejection needs a reason" };
  }
  const qualifier = String(input.qualifier ?? "").trim().toLowerCase();
  if (!QUALIFIERS.includes(qualifier)) return { ok: false, error: "unknown qualifier" };
  const whose = String(input.whose ?? "").trim().toLowerCase();
  if (!WHOSE.includes(whose)) return { ok: false, error: "unknown owner" };
  const grade = String(input.grade ?? "").trim().toUpperCase();
  if (!GRADES.includes(grade)) return { ok: false, error: "grade must be A–D" };
  const basis = String(input.basis ?? "").trim().slice(0, 500);
  if ((grade === "A" || grade === "B") && !basis) {
    return { ok: false, error: `grade ${grade} needs a written basis` };
  }

  const at = new Date().toISOString();
  await db
    .prepare(
      `UPDATE person_numbers
          SET review_status = ?, reviewed_at = ?,
              qualifier = CASE WHEN ? = '' THEN qualifier ELSE ? END,
              whose = CASE WHEN ? = '' THEN whose ELSE ? END,
              evidence_grade = CASE WHEN ? = '' THEN evidence_grade ELSE ? END,
              grade_basis = CASE WHEN ? = '' THEN grade_basis ELSE ? END
        WHERE slug = ? AND kind = ? AND label = ?`,
    )
    .bind(
      input.status,
      at,
      qualifier,
      qualifier,
      whose,
      whose,
      grade,
      grade,
      basis,
      basis,
      input.slug,
      input.kind,
      input.label,
    )
    .run();
  return { ok: true };
}
