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

interface Theatre {
  id: string;
  place: string;
  queries: string[];
}

/**
 * The theatre list. Every theatre is swept once per year, because a 2023
 * massacre and a 2025 one are different events with different paperwork, and a
 * single three-year window buries the older one under the newer coverage.
 */
const THEATRES: Theatre[] = [
  { id: "gaza", place: "Gaza", queries: [
    "Gaza civilian deaths UN OCHA report",
    "Gaza arms transfer approval government",
    "Gaza famine IPC report",
    "Gaza hospital strike investigation" ] },
  { id: "ukraine", place: "Ukraine", queries: [
    "Ukraine civilian casualties UN report",
    "Russia strike aid centre casualties",
    "Ukraine arms package approved",
    "Ukraine power grid attack" ] },
  { id: "sudan", place: "Sudan", queries: [
    "Sudan RSF massacre report UN",
    "Sudan arms suppliers UAE report",
    "Sudan displacement famine IPC",
    "Sudan El Fasher siege casualties" ] },
  { id: "myanmar", place: "Myanmar", queries: [
    "Myanmar airstrike civilians report",
    "Myanmar junta arms suppliers",
    "Myanmar Rohingya persecution report" ] },
  { id: "westbank", place: "West Bank", queries: [
    "West Bank settler violence report UN",
    "West Bank demolition displacement",
    "Israel incursions Jenin casualties" ] },
  { id: "drc", place: "DR Congo", queries: [
    "DR Congo M23 massacre report",
    "DR Congo cobalt mining abuses",
    "DR Congo Rwanda support UN report" ] },
  { id: "lebanon", place: "Lebanon", queries: [
    "Lebanon strike casualties report",
    "Lebanon pager attack investigation",
    "Lebanon displacement UN" ] },
  { id: "iran", place: "Iran", queries: [
    "Iran strikes casualties report",
    "Iran nuclear site attack",
    "Iran civilian harm UN" ] },
  { id: "yemen", place: "Yemen", queries: [
    "Yemen coalition airstrike civilians report",
    "Yemen famine aid blockade",
    "Yemen arms supply report" ] },
  { id: "ethiopia", place: "Ethiopia", queries: [
    "Ethiopia Tigray war crimes report",
    "Ethiopia famine aid obstruction",
    "Ethiopia drone strike civilians" ] },
  { id: "haiti", place: "Haiti", queries: [
    "Haiti gang violence massacre report",
    "Haiti arms trafficking report",
    "Haiti displacement UN" ] },
  { id: "sahel", place: "Sahel", queries: [
    "Sahel massacre report UN",
    "Sahel arms supply Wagner",
    "Sahel displacement famine" ] },
];

const YEARS = [2023, 2024, 2025];

/** The standing record, one case per name across the whole window. */
const PERSON_CASES: Case[] = [
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
  { id: "netanyahu-record", place: "Israel", after: "2023-01-01", before: "2026-12-31",
    subject: "Benjamin Netanyahu",
    queries: ["Netanyahu ICC arrest warrant Gaza", "Netanyahu government settlement expansion approval", "Netanyahu Quneitra Syria incursion 2026"] },
  { id: "putin-record", place: "Russia", after: "2022-01-01", before: "2026-12-31",
    subject: "Vladimir Putin",
    queries: ["Putin ICC arrest warrant Ukraine invasion", "Russia strikes aid infrastructure Ukraine order", "Putin political repression Navalny"] },
  { id: "hemedti-record", place: "Sudan", after: "2023-01-01", before: "2026-12-31",
    subject: "Mohamed Hamdan Dagalo",
    queries: ["Hemedti RSF El Fasher massacre", "RSF arms supply UAE report Hemedti", "RSF gold smuggling Hemedti report"] },
  { id: "burhan-record", place: "Sudan", after: "2023-01-01", before: "2026-12-31",
    subject: "Abdel Fattah al-Burhan",
    queries: ["al-Burhan Sudanese armed forces war conduct", "Sudan army siege famine report Burhan", "Burhan airstrikes civilians Sudan"] },
  { id: "mbs-record", place: "Saudi Arabia", after: "2015-01-01", before: "2026-12-31",
    subject: "Mohammed bin Salman",
    queries: ["Mohammed bin Salman Yemen war coalition strikes", "Khashoggi killing CIA assessment MBS", "Saudi sovereign fund media capture MBS"] },
];

/**
 * The full matrix: twelve theatres × three years, plus the standing record.
 * Fifty cases. The cron walks them five at a time; a one-off can walk them
 * faster. Every case is idempotent, so a re-run only adds what is missing.
 */
export const CASES: Case[] = [
  ...THEATRES.flatMap((t) =>
    YEARS.map((year) => ({
      id: `${t.id}-${year}`,
      place: t.place,
      after: `${year}-01-01`,
      before: `${year}-12-31`,
      queries: t.queries,
    })),
  ),
  ...PERSON_CASES,
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
8. If the case carries a subject, every entry must be about that subject and no one else. Give the subject's full public name exactly as it appears in reporting. An act carried out by a company counts as the subject's when they are its chief executive, founder or controlling owner — say so in the act ("Oracle, under Ellison, ...").

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
          content: JSON.stringify({ case: c.id, place: c.place, subject: c.subject, window: { after: c.after, before: c.before }, results: results.slice(0, 32) }),
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
