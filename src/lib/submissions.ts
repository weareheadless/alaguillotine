import { getCloudflareContext } from "@opennextjs/cloudflare";
import { registerQueueNames } from "./coverage";
import { slugify } from "./slug";

/**
 * Names proposed by the public.
 *
 * The queue itself is written by Ada's research passes; this table is the
 * front door. A submission is read by Ada: the site gathers the reporting,
 * she rules, and the verdict is written here. The review desk can still
 * overrule a pending proposal. On approval the name is written into
 * `queue_people`, where it keeps its own counter like every other name.
 *
 * No account and no email. The receipt code is the submitter's only handle, so
 * it is random, unguessable, and never listed publicly.
 */

type D1Result = { results?: Array<Record<string, unknown>> };
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T = D1Result>() => Promise<T>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};
export type D1 = { prepare: (query: string) => D1Statement };

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface NameSubmission {
  id: string;
  code: string;
  name: string;
  role: string;
  country: string;
  acts: string;
  sources: string[];
  why: string;
  submitter: string;
  status: SubmissionStatus;
  verdict: string;
  reviewer: string;
  createdAt: string;
  reviewedAt: string | null;
}

export type PublicSubmission = Omit<
  NameSubmission,
  "id" | "ipHash" | "reviewer" | "submitter"
>;

async function getDb(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 };
  };
  return context.env?.D1 ?? null;
}

/** Server components read the queue through this. */
export async function submissionDb(): Promise<D1 | null> {
  return getDb();
}

function rowToSubmission(row: Record<string, unknown>): NameSubmission {
  let sources: string[] = [];
  try {
    const parsed = JSON.parse(String(row.sources ?? "[]"));
    if (Array.isArray(parsed)) sources = parsed.map(String).slice(0, 5);
  } catch {
    sources = [];
  }
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    role: String(row.role ?? ""),
    country: String(row.country ?? ""),
    acts: String(row.acts ?? ""),
    sources,
    why: String(row.why ?? ""),
    submitter: String(row.submitter ?? ""),
    status: (String(row.status ?? "pending") as SubmissionStatus) ?? "pending",
    verdict: String(row.verdict ?? ""),
    reviewer: String(row.reviewer ?? ""),
    createdAt: String(row.created_at ?? ""),
    reviewedAt: row.reviewed_at == null ? null : String(row.reviewed_at),
  };
}

/** Codes are read aloud and typed by hand; no 0/O/1/I. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Store a hash of the address, never the address itself. */
export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`ala-guillotine:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface NewSubmission {
  name: string;
  role: string;
  country: string;
  acts: string;
  sources: string[];
  why: string;
  submitter: string;
  ipHash: string;
}

/** How many submissions this address made in the last 24 hours. */
export async function countRecentByIp(
  db: D1,
  ipHash: string,
  hours = 24,
): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM name_submissions WHERE ip_hash = ? AND created_at > ?",
    )
    .bind(ipHash, since)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function createSubmission(
  db: D1,
  input: NewSubmission,
): Promise<NameSubmission> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // A collision is astronomically unlikely, but a duplicate code must never
  // map one person's receipt to another person's name.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    try {
      await db
        .prepare(
          `INSERT INTO name_submissions
             (id, code, name, role, country, acts, sources, why, submitter, status, ip_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .bind(
          id,
          code,
          input.name,
          input.role,
          input.country,
          input.acts,
          JSON.stringify(input.sources),
          input.why,
          input.submitter,
          input.ipHash,
          now,
        )
        .run();
      return {
        id,
        code,
        name: input.name,
        role: input.role,
        country: input.country,
        acts: input.acts,
        sources: input.sources,
        why: input.why,
        submitter: input.submitter,
        status: "pending",
        verdict: "",
        reviewer: "",
        createdAt: now,
        reviewedAt: null,
      };
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      if (!message.includes("UNIQUE") || attempt === 4) throw err;
    }
  }
  throw new Error("could not allocate a receipt code");
}

export async function getSubmissionByCode(
  db: D1,
  code: string,
): Promise<NameSubmission | null> {
  const row = await db
    .prepare("SELECT * FROM name_submissions WHERE code = ?")
    .bind(code.trim().toUpperCase())
    .first<Record<string, unknown>>();
  return row ? rowToSubmission(row) : null;
}

export async function listSubmissions(
  db: D1,
  status: SubmissionStatus | "all" = "pending",
  limit = 100,
): Promise<NameSubmission[]> {
  const statement =
    status === "all"
      ? db
          .prepare(
            "SELECT * FROM name_submissions ORDER BY created_at DESC LIMIT ?",
          )
          .bind(limit)
      : db
          .prepare(
            "SELECT * FROM name_submissions WHERE status = ? ORDER BY created_at DESC LIMIT ?",
          )
          .bind(status, limit);
  const rows = await statement.all();
  return (rows.results ?? []).map(rowToSubmission);
}

export async function getSubmissionById(
  db: D1,
  id: string,
): Promise<NameSubmission | null> {
  const row = await db
    .prepare("SELECT * FROM name_submissions WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? rowToSubmission(row) : null;
}

export interface ReviewInput {
  id: string;
  action: "approve" | "reject";
  /** Ada's reason, shown to the submitter either way. */
  verdict: string;
  /** The score the name enters the line with; ignored on reject. */
  score?: number;
  role?: string;
  country?: string;
  reviewer?: string;
}

/**
 * Approve or reject one submission. Approval writes the name into the queue,
 * with the verdict as its charge, so it stands under its own blade.
 */
export async function reviewSubmission(
  db: D1,
  input: ReviewInput,
): Promise<{ ok: boolean; error?: string; submission?: NameSubmission }> {
  const submission = await getSubmissionById(db, input.id);
  if (!submission) return { ok: false, error: "not found" };
  if (submission.status !== "pending")
    return { ok: false, error: "already reviewed" };

  const now = new Date().toISOString();
  const status: SubmissionStatus =
    input.action === "approve" ? "approved" : "rejected";

  await db
    .prepare(
      `UPDATE name_submissions
         SET status = ?, verdict = ?, reviewer = ?, reviewed_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .bind(status, input.verdict, input.reviewer ?? "ada", now, input.id)
    .run();

  if (input.action === "approve") {
    const slug = slugify(submission.name);
    if (!slug) return { ok: false, error: "name has no usable slug" };

    let rank = 0;
    try {
      const row = await db
        .prepare("SELECT COALESCE(MAX(rank), 0) AS n FROM queue_people")
        .first<{ n: number }>();
      rank = Number(row?.n ?? 0) + 1;
    } catch {
      rank = 0;
    }

    await db
      .prepare(
        `INSERT INTO queue_people
           (id, name, slug, role, country, reason, score, mentions, rank, prev_rank,
            added_at, last_seen_at, items, source, source_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, '[]', 'submission', ?)
         ON CONFLICT(slug) DO UPDATE SET
           role = excluded.role,
           country = excluded.country,
           reason = excluded.reason,
           score = MAX(queue_people.score, excluded.score),
           source = 'submission',
           source_url = excluded.source_url`,
      )
      .bind(
        crypto.randomUUID(),
        submission.name,
        slug,
        input.role?.trim() || submission.role,
        input.country?.trim() || submission.country,
        input.verdict || submission.acts,
        Math.max(0, Math.min(100, Number(input.score ?? 0))),
        rank,
        now,
        now,
        submission.sources[0] ?? "",
      )
      .run();

    // The review read the claim; the first look reads the whole record.
    await registerQueueNames(db);
  }

  return {
    ok: true,
    submission: {
      ...submission,
      status,
      verdict: input.verdict,
      reviewer: input.reviewer ?? "ada",
      reviewedAt: now,
    },
  };
}