import { readQueue } from "./hate-store";
import {
  reviewSubmission,
  type D1,
  type NameSubmission,
} from "./submissions";

/**
 * Ada reviews a proposed name.
 *
 * The site gathers the reporting; she makes the call. Two hard rules shape
 * this: she gets evidence fetched now (never just the submitter's word), and
 * the ruling is hers — approve, reject, score and say why. If the evidence
 * cannot be gathered or she is unreachable, the proposal stays pending for the
 * human at the review desk.
 */

export interface ReviewEnv {
  DEEPSEEK_API_KEY?: string;
  CLOCK_SEARCH_BASE?: string;
  CHAT_UPSTREAM?: string;
  ADA_KEY?: string;
}

interface Evidence {
  title: string;
  site: string;
  date: string | null;
  url: string;
  summary: string;
  content: string;
  submitted: boolean;
  authority: number;
}

const clip = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

async function search(
  query: string,
  env: ReviewEnv,
): Promise<Array<Record<string, unknown>>> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) return [];
  const base = env.CLOCK_SEARCH_BASE || "https://api.deepseek.com";
  try {
    const response = await fetch(`${base}/v1/tools/search`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ query, count: 4, need_content: true }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { results?: Array<Record<string, unknown>> };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/** Read one submitted link, so the submitter's own evidence is on the table. */
async function fetchSource(url: string): Promise<Evidence | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; alaguillotine/1.0)" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) return null;
    const body = await response.text();
    const text = stripHtml(body).slice(0, 4000);
    if (text.length < 80) return null;
    return {
      title: clip(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url, 200),
      site: clip(new URL(url).hostname.replace(/^www\./, ""), 80),
      date: null,
      url,
      summary: text.slice(0, 500),
      content: text,
      submitted: true,
      authority: 0,
    };
  } catch {
    return null;
  }
}

async function gatherEvidence(
  submission: NameSubmission,
  env: ReviewEnv,
): Promise<Evidence[]> {
  const name = submission.name;
  const claim = clip(submission.acts, 120);
  const queries = [
    `"${name}" ${claim}`,
    `"${name}" ${clip(submission.role, 60)} ${clip(submission.country, 40)}`,
    `"${name}" ${clip(submission.why, 80)}`,
  ];

  const results = await Promise.all(queries.map((q) => search(q, env)));
  const submitted = new Set(submission.sources.map((s) => s.trim()));
  const seen = new Set<string>();
  const evidence: Evidence[] = [];

  for (const hit of results.flat()) {
    const url = String(hit.url ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    evidence.push({
      title: clip(hit.title, 200),
      site: clip(hit.site_name ?? "unknown", 80),
      date: typeof hit.date === "string" ? hit.date.slice(0, 10) : null,
      url: url.slice(0, 500),
      summary: clip(hit.summary, 700),
      content: clip(hit.content ?? hit.summary, 1600),
      submitted: submitted.has(url),
      authority: typeof hit.authority === "number" ? hit.authority : 0,
    });
    if (evidence.length >= 8) break;
  }

  // The submitted links themselves: context, never corroboration.
  const fetched = await Promise.all(
    submission.sources.slice(0, 2).map((url) => fetchSource(url)),
  );
  for (const source of fetched) {
    if (source && !seen.has(source.url)) {
      seen.add(source.url);
      evidence.push(source);
    }
  }

  return evidence.slice(0, 10);
}

interface ReviewVerdict {
  decision: "approve" | "reject";
  score: number;
  verdict: string;
}

async function askAda(
  submission: NameSubmission,
  evidence: Evidence[],
  queue: Array<{ name: string; score: number }>,
  env: ReviewEnv,
): Promise<ReviewVerdict | null> {
  if (!env.ADA_KEY) return null;
  const base = env.CHAT_UPSTREAM || "https://api.helloada.app/ada";
  try {
    const response = await fetch(`${base}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Ada-Key": env.ADA_KEY },
      body: JSON.stringify({
        proposal: {
          name: submission.name,
          role: submission.role,
          country: submission.country,
          acts: submission.acts,
          why: submission.why,
          sources: submission.sources,
        },
        evidence: evidence.map((e) => ({
          title: e.title,
          site: e.site,
          date: e.date,
          url: e.url,
          summary: e.summary,
          content: e.content.slice(0, 1200),
          independent: !e.submitted,
          authority: e.authority,
        })),
        queue,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("ada_review_http", submission.code, response.status, detail.slice(0, 300));
      return null;
    }
    const data = (await response.json()) as Record<string, unknown>;
    const decision = String(data.decision ?? "");
    const verdict = String(data.verdict ?? "").trim().slice(0, 800);
    const score = Number(data.score ?? 0);
    if (decision !== "approve" && decision !== "reject") {
      console.error("ada_review_bad_decision", submission.code, decision);
      return null;
    }
    if (verdict.length < 10) {
      console.error("ada_review_short_verdict", submission.code);
      return null;
    }
    return {
      decision,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
      verdict,
    };
  } catch (error) {
    console.error("ada_review_failed", submission.code, String(error));
    return null;
  }
}

/**
 * Gather, judge, and write the ruling. Any failure leaves the proposal pending:
 * the review desk is still there, and a missing verdict is not a rejection.
 */
export async function reviewByAda(
  db: D1,
  submission: NameSubmission,
  env: ReviewEnv,
): Promise<void> {
  const evidence = await gatherEvidence(submission, env);
  let queue: Array<{ name: string; score: number }> = [];
  try {
    queue = (await readQueue(db))
      .slice(0, 10)
      .map((figure) => ({ name: figure.name, score: figure.score }));
  } catch {
    queue = [];
  }

  const verdict = await askAda(submission, evidence, queue, env);
  if (!verdict) return;

  await reviewSubmission(db, {
    id: submission.id,
    action: verdict.decision,
    verdict: verdict.verdict,
    score: verdict.score,
    role: submission.role,
    country: submission.country,
    reviewer: "ada",
  });
}
