import { actDate } from "./evidence";

/**
 * Evidence review.
 *
 * A row in the ledger is a claim. Until this existed, every claim counted the
 * same: a court finding, an automatic receipt filed from a headline, and a
 * sanctions listing whose date was the enforcement date rather than the act.
 *
 * Nothing is deleted. A claim is pending, accepted, rejected or legacy, the
 * reason is written down, and only accepted and legacy claims score. Legacy
 * means "filed before review existed"; it keeps its score until an editor has
 * looked at it, and the audit below moves the ones that cannot stand.
 */

export type ReviewStatus = "pending" | "accepted" | "rejected" | "legacy";

export interface ReviewDb {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      run: () => Promise<unknown>;
      all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
    };
  };
}

export interface ReviewRow {
  id: string;
  person: string;
  role: string;
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  sources: string[];
  caseId: string;
  createdAt: string;
  reviewStatus: ReviewStatus;
  reviewNote: string;
  reviewedAt: string | null;
  actDate: string | null;
  datePrecision: string;
}

const rowToReview = (r: Record<string, unknown>): ReviewRow => {
  let sources: string[] = [];
  try {
    sources = JSON.parse(String(r.sources ?? "[]")) as string[];
  } catch {
    sources = [];
  }
  return {
    id: String(r.id ?? ""),
    person: String(r.person ?? ""),
    role: String(r.role ?? ""),
    act: String(r.act ?? ""),
    place: String(r.place ?? ""),
    year: Number(r.year ?? 0),
    category: String(r.category ?? ""),
    confidence: Number(r.confidence ?? 0),
    sources,
    caseId: String(r.case_id ?? ""),
    createdAt: String(r.created_at ?? ""),
    reviewStatus: String(r.review_status ?? "legacy") as ReviewStatus,
    reviewNote: String(r.review_note ?? ""),
    reviewedAt: r.reviewed_at == null ? null : String(r.reviewed_at),
    actDate: r.act_date == null ? null : String(r.act_date),
    datePrecision: String(r.date_precision ?? "year"),
  };
};

export async function listEvidence(
  db: ReviewDb,
  options: { status?: ReviewStatus | "all"; person?: string; limit?: number; offset?: number } = {},
): Promise<{ rows: ReviewRow[]; total: number }> {
  const status = options.status ?? "pending";
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (status !== "all") {
    where.push("review_status = ?");
    binds.push(status);
  }
  if (options.person) {
    where.push("lower(person) LIKE ?");
    binds.push(`%${options.person.trim().toLowerCase()}%`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = await db
    .prepare(`SELECT COUNT(*) AS n FROM ledger_entries ${clause}`)
    .bind(...binds)
    .first<{ n?: number }>();
  const rows = await db
    .prepare(
      `SELECT id, person, role, act, place, year, category, confidence, sources, case_id,
              created_at, review_status, review_note, reviewed_at, act_date, date_precision
         FROM ledger_entries ${clause}
        ORDER BY created_at DESC, rowid DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all();

  return {
    total: Number(total?.n ?? 0),
    rows: (rows.results ?? []).map(rowToReview),
  };
}

/** Accept or reject one claim, with a reason that stays on the record. */
export async function reviewEvidence(
  db: ReviewDb,
  input: { id: string; status: ReviewStatus; note?: string; reviewer?: string },
): Promise<{ ok: boolean; error?: string; row?: ReviewRow }> {
  if (!["accepted", "rejected", "pending"].includes(input.status)) {
    return { ok: false, error: "unknown status" };
  }
  const note = String(input.note ?? "").trim().slice(0, 500);
  if (input.status === "rejected" && !note) {
    return { ok: false, error: "a rejection needs a reason" };
  }

  const before = await db
    .prepare("SELECT * FROM ledger_entries WHERE id = ?")
    .bind(input.id)
    .first<Record<string, unknown>>();
  if (!before) return { ok: false, error: "not found" };

  const at = new Date().toISOString();
  const reviewer = String(input.reviewer ?? "editor").slice(0, 60);
  await db
    .prepare(
      "UPDATE ledger_entries SET review_status = ?, review_note = ?, reviewed_at = ? WHERE id = ?",
    )
    .bind(input.status, note, at, input.id)
    .run();

  await db
    .prepare(
      `INSERT INTO ledger_revisions (id, entry_id, person, from_status, to_status, note, reviewer, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.id,
      String(before.person ?? ""),
      String(before.review_status ?? "legacy"),
      input.status,
      note,
      reviewer,
      at,
    )
    .run();

  const after = await db
    .prepare(
      `SELECT id, person, role, act, place, year, category, confidence, sources, case_id,
              created_at, review_status, review_note, reviewed_at, act_date, date_precision
         FROM ledger_entries WHERE id = ?`,
    )
    .bind(input.id)
    .first<Record<string, unknown>>();

  return { ok: true, row: after ? rowToReview(after) : undefined };
}

export interface AuditReport {
  scanned: number;
  flagged: number;
  byRule: Record<string, number>;
  examples: Array<{ person: string; act: string; rule: string }>;
}

/**
 * Move the claims that cannot stand into review.
 *
 * These are mechanical rules, not judgements: a sanctions listing dated by the
 * enforcement, an automatic receipt, a claim whose own sentence talks about
 * conduct years before it was filed, and anything below the credible-reporting
 * floor. Each one is set to pending with its reason, so it leaves the score
 * without leaving the record.
 */
export async function auditEvidence(db: ReviewDb): Promise<AuditReport> {
  const rows = await db
    .prepare(
      `SELECT id, person, act, year, confidence, case_id, review_status
         FROM ledger_entries
        WHERE review_status = 'legacy'`,
    )
    .bind()
    .all();

  const year = new Date().getUTCFullYear();
  const byRule: Record<string, number> = {};
  const examples: Array<{ person: string; act: string; rule: string }> = [];
  let flagged = 0;

  const flag = async (
    id: string,
    rule: string,
    note: string,
    person: string,
    act: string,
  ): Promise<void> => {
    await db
      .prepare(
        `UPDATE ledger_entries
            SET review_status = 'pending', review_note = ?
          WHERE id = ? AND review_status = 'legacy'`,
      )
      .bind(note, id)
      .run();
    byRule[rule] = (byRule[rule] ?? 0) + 1;
    flagged += 1;
    if (examples.length < 25) examples.push({ person, act: act.slice(0, 140), rule });
  };

  for (const r of rows.results ?? []) {
    const id = String(r.id ?? "");
    const person = String(r.person ?? "");
    const act = String(r.act ?? "");
    const caseId = String(r.case_id ?? "");
    const confidence = Number(r.confidence ?? 0);
    const filed = Number(r.year ?? 0);

    if (caseId.startsWith("un:")) {
      await flag(
        id,
        "sanctions-listing",
        "The date is the enforcement date, not the conduct date. Review the underlying act.",
        person,
        act,
      );
      continue;
    }
    if (caseId.startsWith("queue:")) {
      await flag(
        id,
        "auto-receipt",
        "Filed automatically from a news item. Confirm the actor and the act date.",
        person,
        act,
      );
      continue;
    }
    if (confidence < 50) {
      await flag(
        id,
        "low-confidence",
        "Below the credible-reporting floor (50). Needs a second source.",
        person,
        act,
      );
      continue;
    }

    // "As junta leader in 1980" filed as a 2026 act: the sentence contradicts
    // the filing year, and the window must not be fooled by it.
    const years = (act.match(/\b(19\d{2}|20\d{2})\b/g) ?? []).map(Number);
    const oldest = years.length ? Math.min(...years) : 0;
    if (oldest && oldest <= year - 2 && filed >= year - 1) {
      await flag(
        id,
        "retrospective",
        `The act mentions ${oldest} but is filed as ${filed}. Confirm the conduct date.`,
        person,
        act,
      );
      continue;
    }

    // No date at all in the sentence and no reviewed act date: half weight is
    // the current guess, and the guess is what needs checking.
    if (!actDate(act, filed)) {
      await flag(
        id,
        "undated",
        "No date in the act. Confirm when it happened.",
        person,
        act,
      );
    }
  }

  return {
    scanned: (rows.results ?? []).length,
    flagged,
    byRule,
    examples,
  };
}

export interface StatusCounts {
  counts: Record<ReviewStatus, number>;
  total: number;
}

export async function reviewCounts(db: ReviewDb): Promise<StatusCounts> {
  const rows = await db
    .prepare("SELECT review_status, COUNT(*) AS n FROM ledger_entries GROUP BY review_status")
    .bind()
    .all();
  const counts: Record<ReviewStatus, number> = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    legacy: 0,
  };
  let total = 0;
  for (const r of rows.results ?? []) {
    const status = String(r.review_status ?? "legacy") as ReviewStatus;
    const n = Number(r.n ?? 0);
    if (status in counts) counts[status] = n;
    total += n;
  }
  return { counts, total };
}
