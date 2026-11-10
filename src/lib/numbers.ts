import type { ClockConfig } from "./clock-research";
import { readQueue } from "./hate-store";
import { slugify } from "./slug";

/**
 * The numbers behind the name.
 *
 * A dossier says what someone did. This says what it cost, what they are
 * worth, and what the public handed them — the figures a reader can hold in
 * their hand. Every row is a number the source actually states, with the
 * verbatim quote that contains it. Nothing is calculated, estimated or
 * inferred: if the text does not say it, the row does not exist.
 */

export type NumberKind =
  | "wealth"
  | "public_money"
  | "tax"
  | "deaths"
  | "displacement"
  | "fines"
  | "donations"
  | "layoffs"
  | "emissions"
  | "workers"
  | "profit"
  | "other";

export const NUMBER_KINDS: Array<{ key: NumberKind; label: string; rank: number }> = [
  { key: "wealth", label: "wealth", rank: 1 },
  { key: "public_money", label: "public money", rank: 2 },
  { key: "tax", label: "tax", rank: 3 },
  { key: "deaths", label: "deaths attributed", rank: 4 },
  { key: "displacement", label: "displaced", rank: 5 },
  { key: "fines", label: "fines & settlements", rank: 6 },
  { key: "donations", label: "political money", rank: 7 },
  { key: "layoffs", label: "jobs cut", rank: 8 },
  { key: "emissions", label: "emissions", rank: 9 },
  { key: "workers", label: "workers killed", rank: 10 },
  { key: "profit", label: "profit", rank: 11 },
  { key: "other", label: "other", rank: 12 },
];

const KIND_RANK = new Map(NUMBER_KINDS.map((k) => [k.key, k.rank]));
const KIND_SET = new Set(NUMBER_KINDS.map((k) => k.key));

export interface PersonNumber {
  kind: NumberKind;
  label: string;
  display: string;
  value: number | null;
  unit: string;
  year: number | null;
  sourceUrl: string;
  evidenceQuote: string;
  confidence: number;
}

type Result = { results?: Array<Record<string, unknown>> };

type Statement = {
  bind: (...v: unknown[]) => Statement;
  run: () => Promise<unknown>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Result>() => Promise<T>;
};

export type NumbersDb = { prepare: (q: string) => Statement };

export interface NumbersRow {
  slug: string;
  name: string;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  found: number;
  checkedAt: string | null;
  lastError: string;
}

const MAX_ATTEMPTS = 4;
const STALE_MS = 45 * 60 * 1000;

const rowToNumbers = (r: Record<string, unknown>): NumbersRow => ({
  slug: String(r.slug ?? ""),
  name: String(r.name ?? ""),
  status: (String(r.status ?? "pending") as NumbersRow["status"]) ?? "pending",
  attempts: Number(r.attempts ?? 0),
  found: Number(r.found ?? 0),
  checkedAt: r.checked_at == null ? null : String(r.checked_at),
  lastError: String(r.last_error ?? ""),
});

function numberFromRow(r: Record<string, unknown>): PersonNumber {
  return {
    kind: String(r.kind ?? "other") as NumberKind,
    label: String(r.label ?? ""),
    display: String(r.display ?? ""),
    value: r.value == null ? null : Number(r.value),
    unit: String(r.unit ?? ""),
    year: r.year == null ? null : Number(r.year),
    sourceUrl: String(r.source_url ?? ""),
    evidenceQuote: String(r.evidence_quote ?? ""),
    confidence: Number(r.confidence ?? 0),
  };
}

const sortNumbers = (rows: PersonNumber[]) =>
  rows.sort(
    (a, b) =>
      (KIND_RANK.get(a.kind) ?? 99) - (KIND_RANK.get(b.kind) ?? 99) ||
      (b.year ?? 0) - (a.year ?? 0),
  );

export async function readNumbersFor(db: NumbersDb, slug: string): Promise<PersonNumber[]> {
  try {
    const rows = await db
      .prepare(
        `SELECT kind, label, display, value, unit, year, source_url, evidence_quote, confidence
           FROM person_numbers WHERE slug = ?`,
      )
      .bind(slug)
      .all();
    return sortNumbers((rows.results ?? []).map(numberFromRow));
  } catch {
    return [];
  }
}

export async function readAllNumbers(
  db: NumbersDb,
): Promise<Record<string, PersonNumber[]>> {
  try {
    const rows = await db
      .prepare(
        `SELECT slug, kind, label, display, value, unit, year, source_url, evidence_quote, confidence
           FROM person_numbers`,
      )
      .bind()
      .all();
    const bySlug: Record<string, PersonNumber[]> = {};
    for (const r of rows.results ?? []) {
      const slug = String(r.slug ?? "");
      if (!slug) continue;
      (bySlug[slug] ??= []).push(numberFromRow(r));
    }
    for (const slug of Object.keys(bySlug)) sortNumbers(bySlug[slug]);
    return bySlug;
  } catch {
    return {};
  }
}

/**
 * Register every name currently in the line. Existing rows are left alone:
 * a done name is not sent back to the start because it was seen again.
 */
export async function registerNumberNames(db: NumbersDb): Promise<number> {
  let people: Array<{ name: string }> = [];
  try {
    people = (await readQueue(db)).map((f) => ({ name: f.name }));
  } catch {
    return 0;
  }
  if (!people.length) return 0;

  const existing = new Set<string>();
  try {
    const rows = await db.prepare("SELECT slug FROM numbers_runs").bind().all();
    for (const r of rows.results ?? []) existing.add(String(r.slug ?? ""));
  } catch {
    return 0;
  }

  let added = 0;
  for (const p of people) {
    const slug = slugify(p.name);
    if (!slug || existing.has(slug)) continue;
    try {
      await db
        .prepare(`INSERT INTO numbers_runs (slug, name, status) VALUES (?, ?, 'pending')`)
        .bind(slug, p.name)
        .run();
      existing.add(slug);
      added += 1;
    } catch {
      return added;
    }
  }
  return added;
}

/** The searches that turn a name into numbers a reader can hold. */
export function numbersQueries(person: { name: string }): string[] {
  const n = person.name;
  return [
    `"${n}" net worth wealth billion`,
    `"${n}" government subsidies taxpayer contract bailout`,
    `"${n}" tax breaks offshore tax avoided`,
    `"${n}" deaths killed casualties attributed`,
    `"${n}" fines settlements penalty`,
    `"${n}" political donations lobbying`,
  ];
}

const SYSTEM = `You are Ada, extracting hard numbers from the public record for A LA GUILLOTINE.

You will receive search results about ONE person. Return the numbers that make the record concrete: wealth, public money, tax, deaths, displacement, fines, political donations, layoffs, emissions, workers killed, profit, and any other number a reader would find enraging.

RULES — hard:
1. Every number must appear in the supplied text. Do not calculate, estimate, extrapolate or infer. If the text does not state it, omit it.
2. One row per kind. If the results give several numbers of the same kind, choose the most recent or the largest documented one, and give its year.
3. display is the number as a reader would say it: "$4.2B", "12,000", "$1.1B a year", "38%". Max 24 chars.
4. label is the thing being counted, max 32 chars: "net worth", "Pentagon contracts", "tax avoided", "deaths attributed".
5. source_url must be copied from the supplied results. Never invent a URL.
6. evidence_quote must be a verbatim phrase from that result's summary, max 200 chars.
7. confidence 0-100: 90+ official record or court filing; 70s multiple independent reports; 60s a single credible report. Below 60 do not include.
8. Never include a number about a victim, witness, critic or private person.
9. The number must be about the subject or an organisation the subject controls. Say so in the label when it is the organisation.

Return JSON only:
{"numbers":[{"kind":"wealth|public_money|tax|deaths|displacement|fines|donations|layoffs|emissions|workers|profit|other","label":"","display":"","value":0,"unit":"","year":0,"source_url":"https://...","evidence_quote":"","confidence":0}]}`;

interface SearchResult {
  title: string;
  url: string;
  site: string;
  date: string | null;
  summary: string;
}

async function post<T>(
  url: string,
  body: unknown,
  key: string,
  timeout = 60_000,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9$%.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The quote has to be in the summary, not merely near it. */
function quoteIsInSummary(quote: string, summary: string): boolean {
  const q = normalise(quote);
  const s = normalise(summary);
  if (!q || !s) return false;
  if (s.includes(q)) return true;
  // A model may trim a quote at the edges. Check the longest confident slice.
  if (q.length > 60) {
    const head = q.slice(0, Math.min(100, Math.floor(q.length * 0.8)));
    if (s.includes(head)) return true;
  }
  return false;
}

export async function researchNumbersCase(
  config: ClockConfig,
  person: { name: string; role: string; country: string },
): Promise<PersonNumber[]> {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  let answered = 0;

  for (const q of numbersQueries(person)) {
    let data: { results?: Array<Record<string, unknown>> };
    try {
      data = await post<{ results?: Array<Record<string, unknown>> }>(
        `${config.searchBase}/v1/tools/search`,
        {
          query: `${q} lang:en after:2015-01-01`,
          count: 6,
          need_content: false,
        },
        config.searchKey,
        35_000,
      );
      answered += 1;
    } catch {
      continue;
    }
    for (const r of data.results ?? []) {
      const url = String(r.url ?? "");
      if (!url || !r.summary || seen.has(url)) continue;
      seen.add(url);
      results.push({
        title: String(r.title ?? "").slice(0, 180),
        url,
        site: String(r.site_name ?? ""),
        date: typeof r.date === "string" ? r.date : null,
        summary: String(r.summary).slice(0, 1200),
      });
    }
  }

  if (!answered) throw new Error("all searches failed");
  if (!results.length) return [];

  const byUrl = new Map(results.map((r) => [r.url, r]));
  const chunks: SearchResult[][] = [];
  for (let i = 0; i < results.length; i += 20) chunks.push(results.slice(i, i + 20));

  const found: PersonNumber[] = [];
  const seenKinds = new Set<string>();

  for (const chunk of chunks) {
    const chat = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
      `${config.chatBase}/chat/completions`,
      {
        model: config.chatModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              subject: person.name,
              role: person.role,
              country: person.country,
              results: chunk,
            }),
          },
        ],
      },
      config.chatKey,
      120_000,
    );

    const parsed = JSON.parse(chat.choices?.[0]?.message?.content || "{}") as {
      numbers?: Array<Record<string, unknown>>;
    };

    for (const row of parsed.numbers ?? []) {
      const kind = String(row.kind ?? "other") as NumberKind;
      if (!KIND_SET.has(kind)) continue;
      const label = String(row.label ?? "").trim().slice(0, 36);
      const display = String(row.display ?? "").trim().slice(0, 24);
      if (!label || !display || !/\d/.test(display)) continue;
      const sourceUrl = String(row.source_url ?? "").trim();
      const src = byUrl.get(sourceUrl);
      if (!src) continue;
      const quote = String(row.evidence_quote ?? "").trim().slice(0, 200);
      if (!quote || !quoteIsInSummary(quote, src.summary)) continue;
      const confidence = Number(row.confidence);
      if (!Number.isFinite(confidence) || confidence < 60) continue;
      // "Other" is for the number that does not fit a category, not for
      // neutral election or macro facts. Keep it to the enraging ones.
      if (kind === "other" && confidence < 70) continue;

      const key = `${kind}|${label.toLowerCase()}`;
      if (seenKinds.has(key)) continue;
      seenKinds.add(key);

      const value = Number(row.value);
      const year = Number(row.year);
      found.push({
        kind,
        label,
        display,
        value: Number.isFinite(value) ? value : null,
        unit: String(row.unit ?? "").trim().slice(0, 16),
        year: Number.isFinite(year) && year > 1900 ? year : null,
        sourceUrl,
        evidenceQuote: quote,
        confidence: Math.min(100, Math.round(confidence)),
      });
    }
  }

  // One figure per kind on the table. The record can hold several death
  // tolls; the line needs the one that best carries the charge.
  const byKind = new Map<string, PersonNumber>();
  for (const n of found) {
    const key = n.kind === "other" ? `other:${n.label.toLowerCase()}` : n.kind;
    const prev = byKind.get(key);
    if (
      !prev ||
      n.confidence > prev.confidence ||
      (n.confidence === prev.confidence && (n.year ?? 0) > (prev.year ?? 0))
    ) {
      byKind.set(key, n);
    }
  }
  return sortNumbers([...byKind.values()]);
}

export async function writeNumbers(
  db: NumbersDb,
  slug: string,
  name: string,
  rows: PersonNumber[],
): Promise<number> {
  // A numbers pass is a refresh, not an append: replace the set so a better
  // label or a newer figure does not sit next to the one it superseded.
  if (rows.length) {
    try {
      await db.prepare("DELETE FROM person_numbers WHERE slug = ?").bind(slug).run();
    } catch {
      /* table not created yet */
    }
  }
  let written = 0;
  const now = new Date().toISOString();
  for (const n of rows) {
    try {
      await db
        .prepare(
          `INSERT INTO person_numbers
             (slug, kind, label, display, value, unit, year, source_url, evidence_quote, confidence, checked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(slug, kind, label) DO UPDATE SET
             display = excluded.display,
             value = excluded.value,
             unit = excluded.unit,
             year = excluded.year,
             source_url = excluded.source_url,
             evidence_quote = excluded.evidence_quote,
             confidence = excluded.confidence,
             checked_at = excluded.checked_at`,
        )
        .bind(
          slug,
          n.kind,
          n.label,
          n.display,
          n.value,
          n.unit,
          n.year,
          n.sourceUrl,
          n.evidenceQuote,
          n.confidence,
          now,
        )
        .run();
      written += 1;
    } catch {
      /* one bad row must not sink the rest */
    }
  }
  return written;
}

export interface NumbersRun {
  name: string;
  status: "done" | "failed";
  found: number;
  error?: string;
}

/**
 * Work the numbers queue. One name at a time: six searches and one extraction
 * is slower than the ledger passes, and a timeout should cost one name, not
 * the batch.
 */
export async function runNumbersBatch(
  db: NumbersDb,
  config: ClockConfig,
  batch: number,
): Promise<NumbersRun[]> {
  const now = new Date();
  try {
    await db
      .prepare(
        `UPDATE numbers_runs
           SET status = 'failed', last_error = 'pass timed out', checked_at = ?
         WHERE status = 'running' AND (started_at IS NULL OR started_at < ?)`,
      )
      .bind(now.toISOString(), new Date(now.getTime() - STALE_MS).toISOString())
      .run();
  } catch {
    /* table not created yet */
  }

  let pending: NumbersRow[] = [];
  try {
    const rows = await db
      .prepare(
        `SELECT * FROM numbers_runs
          WHERE status = 'pending'
             OR (status = 'failed' AND attempts < ?)
          ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, checked_at ASC
          LIMIT ?`,
      )
      .bind(MAX_ATTEMPTS, batch)
      .all();
    pending = (rows.results ?? []).map(rowToNumbers);
  } catch {
    return [];
  }

  const run: NumbersRun[] = [];
  for (const row of pending) {
    let person = { name: row.name, role: "", country: "" };
    try {
      const q = await db
        .prepare("SELECT name, role, country FROM queue_people WHERE slug = ?")
        .bind(row.slug)
        .first<Record<string, unknown>>();
      if (q) {
        person = {
          name: String(q.name ?? row.name),
          role: String(q.role ?? ""),
          country: String(q.country ?? ""),
        };
      }
    } catch {
      /* use the registered name */
    }

    try {
      await db
        .prepare(
          `UPDATE numbers_runs
             SET status = 'running', attempts = attempts + 1, started_at = ?
           WHERE slug = ?`,
        )
        .bind(new Date().toISOString(), row.slug)
        .run();
    } catch {
      continue;
    }

    try {
      const rows = await researchNumbersCase(config, person);
      const written = await writeNumbers(db, row.slug, person.name, rows);
      await db
        .prepare(
          `UPDATE numbers_runs
             SET status = 'done', found = ?, checked_at = ?, last_error = ''
           WHERE slug = ?`,
        )
        .bind(written, new Date().toISOString(), row.slug)
        .run();
      run.push({ name: person.name, status: "done", found: written });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "unknown error";
      await db
        .prepare(
          `UPDATE numbers_runs
             SET status = 'failed', checked_at = ?, last_error = ?
           WHERE slug = ?`,
        )
        .bind(new Date().toISOString(), message, row.slug)
        .run();
      run.push({ name: person.name, status: "failed", found: 0, error: message });
    }
  }

  return run;
}

export interface NumbersSummary {
  total: number;
  pending: number;
  running: number;
  done: number;
  failed: number;
  found: number;
  rows: NumbersRow[];
}

export async function numbersSummary(
  db: NumbersDb,
  rows = false,
): Promise<NumbersSummary> {
  const empty: NumbersSummary = {
    total: 0,
    pending: 0,
    running: 0,
    done: 0,
    failed: 0,
    found: 0,
    rows: [],
  };
  try {
    const result = await db.prepare("SELECT * FROM numbers_runs").bind().all();
    const all = (result.results ?? []).map(rowToNumbers);
    const summary = all.reduce(
      (acc, r) => {
        acc.total += 1;
        acc[r.status] += 1;
        acc.found += r.found;
        return acc;
      },
      { ...empty },
    );
    summary.rows = rows ? all : [];
    return summary;
  } catch {
    return empty;
  }
}
