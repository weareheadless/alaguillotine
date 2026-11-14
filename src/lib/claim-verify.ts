/**
 * The citation check.
 *
 * Nobody can invent proof, and nobody can recognise it by clicking accept. A
 * claim stands on its citation, and a citation is checkable: fetch the page,
 * look for the person, the figures and the distinctive terms the sentence
 * uses. If they are there, the claim is on the record. If they are not, it
 * waits — the source never said it, or could not be read.
 *
 * This is not a truth engine. It cannot tell an investigation from a denial,
 * and it does not try: it answers one question, "does the page say this?", and
 * records exactly what matched so a reader can disagree with the arithmetic.
 */

export interface VerifyDb {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      run: () => Promise<unknown>;
      all: () => Promise<{ results?: Array<Record<string, unknown>> }>;
    };
  };
}

export type VerifyStatus = "verified" | "partial" | "unreachable";

export interface VerifyResult {
  status: VerifyStatus;
  url: string;
  note: string;
  figures: string;
  terms: string;
}

const UA =
  "Mozilla/5.0 (compatible; alaguillotine-research/1.0; +https://alaguillotine.com)";

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "were", "was", "has", "had",
  "have", "his", "her", "their", "they", "them", "which", "after", "before", "over",
  "into", "under", "about", "says", "said", "reported", "reporting", "according",
  "including", "including", "also", "been", "being", "than", "then", "when", "where",
  "while", "would", "could", "should", "more", "most", "some", "such", "only",
]);

/** Lowercase, collapse whitespace, drop punctuation but keep digits and $. */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9$%.' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The figures a sentence rests on: amounts, counts, dates. */
export function figuresOf(text: string): string[] {
  const out = new Set<string>();
  const re = /(?:[$£€]\s?)?\d[\d,.]*\s?(?:billion|million|trillion|thousand|bn|percent|%)?/gi;
  for (const m of text.matchAll(re)) {
    const raw = norm(m[0]).replace(/[.,]$/, "");
    // A bare small number ("3") matches everything; keep amounts, years,
    // percentages and anything with a scale word.
    if (!/^\d+$/.test(raw.replace(/[^\d]/g, ""))) continue;
    if (/^\d{4}$/.test(raw) || /[a-z%]/.test(raw) || raw.replace(/[^\d]/g, "").length >= 3) {
      out.add(raw);
    }
  }
  return [...out];
}

/** Proper names and distinctive words: what makes this sentence this sentence. */
export function termsOf(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b[A-Z][a-zA-Z'-]{3,}\b/g)) {
    const w = m[0].toLowerCase();
    if (!STOP.has(w) && w.length > 4) out.add(w);
  }
  for (const m of text.matchAll(/"([^"]{6,60})"/g)) out.add(norm(m[1]));
  return [...out];
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");
}

async function fetchSource(url: string): Promise<{ ok: boolean; text: string; why: string }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, text: "", why: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("pdf")) return { ok: false, text: "", why: "PDF source, not read here" };
    const html = (await res.text()).slice(0, 400_000);
    const text = norm(htmlToText(html));
    if (text.length < 400) return { ok: false, text: "", why: "page too thin to read" };
    return { ok: true, text, why: "" };
  } catch (error) {
    return {
      ok: false,
      text: "",
      why: error instanceof Error ? error.name : "fetch failed",
    };
  }
}

export interface ClaimRow {
  id: string;
  person: string;
  act: string;
  sources: string[];
}

export async function verifyCitation(claim: ClaimRow): Promise<VerifyResult> {
  const surname = claim.person.trim().split(/\s+/).slice(-1)[0]?.toLowerCase() ?? "";
  const figures = figuresOf(claim.act);
  const terms = termsOf(claim.act);

  let best: VerifyResult = {
    status: "unreachable",
    url: claim.sources[0] ?? "",
    note: "no source",
    figures: `0/${figures.length}`,
    terms: `0/${terms.length}`,
  };
  let bestScore = -1;

  for (const url of claim.sources.slice(0, 2)) {
    const page = await fetchSource(url);
    if (!page.ok) {
      if (bestScore < 0) {
        best = {
          status: "unreachable",
          url,
          note: page.why,
          figures: `0/${figures.length}`,
          terms: `0/${terms.length}`,
        };
      }
      continue;
    }

    const named = surname.length > 2 && page.text.includes(surname);
    const hitFigures = figures.filter((f) => page.text.includes(f));
    const hitTerms = terms.filter((t) => page.text.includes(t));
    const figRate = figures.length ? hitFigures.length / figures.length : 0;
    const termRate = terms.length ? hitTerms.length / terms.length : 0;

    // The person has to be on the page: a page that states the amount about
    // somebody else proves nothing about this claim.
    const score = (named ? 1 : 0) + figRate * 2 + termRate;
    if (score > bestScore) {
      bestScore = score;
      best = {
        status:
          named && (figures.length ? figRate >= 0.6 : true) && termRate >= 0.4
            ? "verified"
            : named && score >= 1.2
              ? "partial"
              : "partial",
        url,
        note: named ? "name found" : "name not found",
        figures: `${hitFigures.length}/${figures.length}`,
        terms: `${hitTerms.length}/${terms.length}`,
      };
    }
    if (best.status === "verified") break;
  }

  return best;
}

export interface CheckReport {
  checked: number;
  verified: number;
  partial: number;
  unreachable: number;
  examples: Array<{ person: string; status: string; note: string }>;
}

/**
 * Check the oldest unchecked pending claims first, so the queue drains instead
 * of the same head being re-fetched every pass.
 */
export async function runCitationCheck(
  db: VerifyDb,
  opts: { limit?: number; days?: number } = {},
): Promise<CheckReport> {
  const limit = Math.min(80, Math.max(1, opts.limit ?? 30));
  const retryAfter = opts.days ?? 14;

  const rows = await db
    .prepare(
      `SELECT id, person, act, sources FROM ledger_entries
        WHERE review_status = 'pending' AND sources != '[]'
          AND (citation_checked_at IS NULL
               OR julianday(citation_checked_at) < julianday('now', ?))
        ORDER BY (citation_checked_at IS NOT NULL), confidence DESC, created_at DESC
        LIMIT ?`,
    )
    .bind(`-${retryAfter} days`, limit)
    .all();

  const report: CheckReport = { checked: 0, verified: 0, partial: 0, unreachable: 0, examples: [] };
  const at = new Date().toISOString();

  for (const raw of rows.results ?? []) {
    const id = String(raw.id ?? "");
    const person = String(raw.person ?? "");
    const act = String(raw.act ?? "");
    let sources: string[] = [];
    try {
      sources = JSON.parse(String(raw.sources ?? "[]")) as string[];
    } catch {
      sources = [];
    }
    if (!id || !sources.length) continue;

    const result = await verifyCitation({ id, person, act, sources });
    report.checked += 1;
    report[result.status] += 1;
    if (report.examples.length < 8) {
      report.examples.push({
        person,
        status: result.status,
        note: `${result.figures} figures, ${result.terms} terms, ${result.note}`,
      });
    }

    const host = (() => {
      try {
        return new URL(result.url).host;
      } catch {
        return result.url;
      }
    })();

    if (result.status === "verified") {
      await db
        .prepare(
          `UPDATE ledger_entries
              SET review_status = 'accepted',
                  reviewed_at = ?,
                  review_note = ?,
                  citation_checked_at = ?,
                  citation_note = ?,
                  grade_basis = CASE WHEN grade_basis IS NULL OR grade_basis = '' THEN ? ELSE grade_basis END
            WHERE id = ? AND review_status = 'pending'`,
        )
        .bind(
          at,
          `citation check: ${result.figures} figures, ${result.terms} terms in ${host}`,
          at,
          `${result.status}: ${result.figures}/${result.terms} ${result.note}`,
          `Citation check: the page at ${host} uses the person and the figures this sentence uses.`,
          id,
        )
        .run();

      // The revision log is the audit trail: an acceptance with no entry in it
      // is an acceptance nobody can check afterwards.
      await db
        .prepare(
          `INSERT INTO ledger_revisions (id, entry_id, person, from_status, to_status, note, reviewer, at)
           VALUES (?, ?, ?, 'pending', 'accepted', ?, 'citation check', ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          person,
          `Citation check: ${result.figures} figures and ${result.terms} terms found in ${host}.`,
          at,
        )
        .run();
    } else {
      await db
        .prepare(
          `UPDATE ledger_entries SET citation_checked_at = ?, citation_note = ? WHERE id = ?`,
        )
        .bind(at, `${result.status}: ${result.figures}/${result.terms} ${result.note} ${host}`, id)
        .run();
    }
  }

  return report;
}
