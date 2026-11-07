import type { ClockConfig } from "./clock-research";

/**
 * Deep research: filling the ledger backwards.
 *
 * Two years of documented harm, case by case. Each invocation takes one case,
 * searches it across a date window, and asks Ada to extract *claims* — person,
 * act, place, date, sources — not vibes. Nothing is accepted without at least
 * two independent URLs.
 *
 * The honest limitation: the corpus is the same corporate press that launders
 * the actors. What survives it are the things that cannot be spun — court
 * filings, UN and OCHA casualty counts, sanctions lists, local outlets. The
 * prompt demands those over wire copy.
 */

export interface Case {
  id: string;
  place: string;
  after: string;
  before: string;
  queries: string[];
  /** When set, every entry must be about this person. */
  subject?: string;
}

export const CASES: Case[] = [
  { id: "gaza-2024", place: "Gaza", after: "2024-01-01", before: "2024-12-31",
    queries: ["Gaza civilian deaths UN OCHA report", "Gaza arms transfer approval government", "Gaza famine IPC report"] },
  { id: "gaza-2025", place: "Gaza", after: "2025-01-01", before: "2025-12-31",
    queries: ["Gaza casualties OCHA 2025", "Gaza weapons sale approved 2025", "Gaza aid blockade report"] },
  { id: "sudan-2024", place: "Sudan", after: "2024-01-01", before: "2024-12-31",
    queries: ["Sudan RSF massacre report UN", "Sudan arms suppliers UAE report", "Sudan displacement famine IPC"] },
  { id: "sudan-2025", place: "Sudan", after: "2025-01-01", before: "2025-12-31",
    queries: ["Sudan El Fasher siege casualties", "Sudan weapons flow report", "Sudan war crimes ICC"] },
  { id: "ukraine-2024", place: "Ukraine", after: "2024-01-01", before: "2024-12-31",
    queries: ["Ukraine civilian casualties UN report", "Russia strike aid centre casualties", "Ukraine arms package approved"] },
  { id: "myanmar-2024", place: "Myanmar", after: "2024-01-01", before: "2025-12-31",
    queries: ["Myanmar airstrike civilians report", "Myanmar junta arms suppliers", "Myanmar Rohingya persecution report"] },
  { id: "westbank-2024", place: "West Bank", after: "2024-01-01", before: "2025-12-31",
    queries: ["West Bank settler violence report UN", "West Bank demolition displacement", "Israel incursions Jenin casualties"] },
  { id: "drc-2024", place: "DR Congo", after: "2024-01-01", before: "2025-12-31",
    queries: ["DR Congo M23 massacre report", "DR Congo cobalt mining abuses", "DR Congo Rwanda support UN report"] },
  { id: "lebanon-2024", place: "Lebanon", after: "2024-01-01", before: "2025-12-31",
    queries: ["Lebanon strike casualties report", "Lebanon pager attack investigation", "Lebanon displacement UN"] },
  { id: "iran-2025", place: "Iran", after: "2025-01-01", before: "2026-12-31",
    queries: ["Iran strikes casualties report", "Iran nuclear site attack", "Iran civilian harm UN"] },

  // The standing record. These are not places; they are the people whose money
  // and machinery the other cases run through. One case each, so the ledger
  // carries the name and not just the country.
  { id: "musk-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Elon Musk",
    queries: ["Elon Musk DOGE USAID dismantling report", "Musk Starlink government contracts investigation", "Musk political donations far-right amplification report"] },
  { id: "thiel-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Peter Thiel",
    queries: ["Peter Thiel Palantir ICE contracts", "Thiel funding JD Vance political rise", "Palantir military targeting contracts investigation"] },
  { id: "karp-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Alex Karp",
    queries: ["Alex Karp Palantir Gaza targeting system", "Palantir deportation ICE contract", "Palantir NHS patient data contract"] },
  { id: "ellison-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Larry Ellison",
    queries: ["Larry Ellison Oracle Israel government cloud", "Ellison political donations influence", "Oracle TikTok deal Ellison"] },
  { id: "luckey-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Palmer Luckey",
    queries: ["Palmer Luckey Anduril border surveillance", "Anduril autonomous weapons contracts", "Anduril lobbying defence procurement"] },
  { id: "kushner-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Jared Kushner",
    queries: ["Jared Kushner Affinity Partners Gulf sovereign funds", "Kushner Middle East policy Gaza", "Affinity Partners investment report"] },
  { id: "adelson-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Miriam Adelson",
    queries: ["Miriam Adelson political donations", "Adelson Las Vegas Review-Journal ownership", "Adelson settlement annexation funding"] },
  { id: "miller-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "Stephen Miller",
    queries: ["Stephen Miller mass deportation policy", "Miller family separation architect", "Miller denaturalisation citizenship"] },
  { id: "sacks-record", place: "United States", after: "2023-01-01", before: "2026-12-31",
    subject: "David Sacks",
    queries: ["David Sacks AI crypto policy conflict", "Sacks venture investments regulation", "Sacks White House adviser"] },
];

const SYSTEM = `You are Ada, keeping the ledger of documented harm for alaguillotine.

You will receive search results for one case. Extract CLAIMS, not summaries.

RULES — hard:
1. Every entry must be supported by at least TWO different source URLs from the supplied results. If you cannot find two, return fewer entries. Zero is an acceptable answer.
2. Never invent a name, number, date or event. If the text does not say it, you do not know it.
3. An entry is about a PERSON who ordered, authorised, funded, armed or profited — not a person who suffered. Victims, witnesses, aid workers, investigators and critics are never entries.
4. Prefer hard sources: court filings, ICC/UN/OCHA reports, sanctions lists, parliamentary records, investigative outlets. Wire copy alone is not enough.
5. act is one sentence, max 200 chars, specific: what was done, where, when.
6. category: war | genocide | repression | arms | extraction | impunity.
7. confidence 0-100: 90+ for a court finding or UN determination; 70s for multiple independent investigations; 50s for credible reporting; below 40 do not include.
8. If the case carries a subject, every entry must be about that subject and no one else. Give the subject's full public name exactly as it appears in reporting.

Return JSON only:
{"entries":[{"person":"","role":"","act":"","place":"","year":2024,"category":"war","confidence":0,"sources":["https://...","https://..."]}]}`;

async function post<T>(url: string, body: unknown, key: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export interface LedgerEntry {
  person: string;
  role: string;
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  sources: string[];
  caseId: string;
}

export async function researchCase(config: ClockConfig, c: Case): Promise<LedgerEntry[]> {
  const results: Array<{ title: string; url: string; site: string; date: string | null; summary: string }> = [];

  for (const q of c.queries) {
    const data = await post<{ results?: Array<Record<string, unknown>> }>(
      `${config.searchBase}/v1/tools/search`,
      { query: `${q} lang:en after:${c.after} before:${c.before}`, count: 6, need_content: false },
      config.searchKey,
    );
    for (const r of data.results ?? []) {
      if (!r.url || !r.summary) continue;
      results.push({
        title: String(r.title ?? "").slice(0, 180),
        url: String(r.url),
        site: String(r.site_name ?? ""),
        date: typeof r.date === "string" ? r.date : null,
        summary: String(r.summary).slice(0, 900),
      });
    }
  }

  if (!results.length) return [];

  const chat = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
    `${config.chatBase}/chat/completions`,
    {
      model: config.chatModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({ case: c.id, place: c.place, subject: c.subject, results: results.slice(0, 24) }),
        },
      ],
    },
    config.chatKey,
  );

  const parsed = JSON.parse(chat.choices?.[0]?.message?.content || "{}") as {
    entries?: Array<Record<string, unknown>>;
  };

  return (parsed.entries ?? []).flatMap((e) => {
    const person = String(e.person ?? "").trim().slice(0, 80);
    const act = String(e.act ?? "").trim().slice(0, 240);
    const sources = (Array.isArray(e.sources) ? e.sources : []).map(String).filter(Boolean);
    const confidence = Number(e.confidence);
    if (!person || !act || sources.length < 2) return [];
    if (!Number.isFinite(confidence) || confidence < 40) return [];
    return [{
      person,
      role: String(e.role ?? "").slice(0, 60),
      act,
      place: String(e.place ?? c.place).slice(0, 60),
      year: Number(e.year) || Number(c.after.slice(0, 4)),
      category: String(e.category ?? "war").slice(0, 20),
      confidence: Math.min(100, Math.round(confidence)),
      sources,
      caseId: c.id,
    }];
  });
}
