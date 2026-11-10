import type { ClockConfig } from "./clock-research";
import type { Case, LedgerEntry } from "./backfill";
import { STANDING } from "./standing";

/**
 * Person dossiers: the long record, angle by angle.
 *
 * The theatre matrix sweeps places and years. This sweeps a person's whole
 * public record across the angles that actually produce charges: money,
 * power, migration, war, labour, climate, courts and foreign dealings. Each
 * angle is its own case, so the cron can walk the record without one giant
 * prompt and a thin answer.
 */

interface Angle {
  id: string;
  label: string;
  queries: (name: string) => string[];
}

export const DOSSIER_ANGLES: Angle[] = [
  {
    id: "finance",
    label: "money, markets and self-dealing",
    queries: (n) => [
      `"${n}" insider trading stock sale SEC`,
      `"${n}" fraud lawsuit settlement fine`,
      `"${n}" tax avoidance offshore emoluments`,
      `"${n}" crypto token conflict of interest`,
      `"${n}" site:sec.gov`,
    ],
  },
  {
    id: "power",
    label: "donations, lobbying and state capture",
    queries: (n) => [
      `"${n}" campaign donation PAC super PAC`,
      `"${n}" lobbying influence peddling`,
      `"${n}" no-bid government contract`,
      `"${n}" conflict of interest policy`,
      `"${n}" pardon family business`,
    ],
  },
  {
    id: "migration",
    label: "detention, deportation and the border",
    queries: (n) => [
      `"${n}" ICE detention camp conditions`,
      `"${n}" mass deportation family separation`,
      `"${n}" concentration camp immigrants`,
      `"${n}" border asylum policy`,
      `"${n}" private prison contract`,
    ],
  },
  {
    id: "war",
    label: "war, arms and occupation",
    queries: (n) => [
      `"${n}" arms sale weapons package`,
      `"${n}" invasion occupation oil`,
      `"${n}" airstrike civilians casualties`,
      `"${n}" defense contract profiteering`,
      `"${n}" military aid approval`,
    ],
  },
  {
    id: "labour",
    label: "workers, unions and safety",
    queries: (n) => [
      `"${n}" union busting layoffs`,
      `"${n}" discrimination lawsuit workplace`,
      `"${n}" wage theft safety violations`,
      `"${n}" worker deaths plant`,
    ],
  },
  {
    id: "climate",
    label: "fossil capital and pollution",
    queries: (n) => [
      `"${n}" fossil fuel lobbying climate`,
      `"${n}" pollution permit emissions`,
      `"${n}" greenwashing advertising`,
      `"${n}" heat deaths attribution`,
    ],
  },
  {
    id: "courts",
    label: "investigations, indictments and penalties",
    queries: (n) => [
      `"${n}" indictment criminal investigation`,
      `"${n}" subpoena attorney general`,
      `"${n}" lawsuit penalty settlement`,
      `"${n}" site:courtlistener.com`,
    ],
  },
  {
    id: "foreign",
    label: "foreign money and foreign policy",
    queries: (n) => [
      `"${n}" Venezuela oil`,
      `"${n}" Saudi Arabia investment`,
      `"${n}" Israel arms`,
      `"${n}" China business`,
      `"${n}" Russia dealings`,
    ],
  },
];

export interface DossierCase extends Case {
  angle: string;
  person: string;
  role: string;
  country: string;
}

const slugifyName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Every person × angle, with a long window. */
export const DOSSIER_CASES: DossierCase[] = STANDING.flatMap((person) =>
  DOSSIER_ANGLES.map((angle) => ({
    id: `dossier:${slugifyName(person.name)}:${angle.id}`,
    angle: angle.id,
    person: person.name,
    role: person.role,
    country: person.country,
    place: person.country,
    after: "2018-01-01",
    before: "2026-12-31",
    subject: person.name,
    queries: angle.queries(person.name),
  })),
);

/**
 * The rolling sweep: what each standing person did in the last few days.
 *
 * The angle dossiers fill the archive; this keeps it from going stale. One
 * case per person per day, a short window, broad queries. Duplicates are
 * merged by act text, so a story already in the ledger does not score twice.
 */
export function recentCases(now: Date = new Date()): DossierCase[] {
  const day = now.toISOString().slice(0, 10);
  const after = new Date(now.getTime() - 4 * 86_400_000).toISOString().slice(0, 10);
  return STANDING.map((person) => ({
    id: `dossier:${slugifyName(person.name)}:recent:${day}`,
    angle: "recent",
    person: person.name,
    role: person.role,
    country: person.country,
    place: person.country,
    after,
    before: day,
    subject: person.name,
    queries: [
      `"${person.name}"`,
      `"${person.name}" news`,
      `"${person.name}" lawsuit OR investigation OR strike OR deal OR contract`,
    ],
  }));
}

const SYSTEM = `You are Ada, building the long record of documented harm for A LA GUILLOTINE.

You will receive search results for ONE person and ONE angle of their record. Extract EVERY distinct documented act you can support, not a summary. Up to 30 entries.

RULES — hard:
1. Every entry must be about the subject, or about an organisation the subject controls — say so in the act ("Oracle, under Ellison, ..."). Never file a victim, witness, critic, investigator or private person.
2. Never invent a name, number, date, event or URL. If the supplied text does not say it, omit it.
3. Prefer primary sources: court filings, SEC/FEC records, sanctions lists, UN/OCHA reports, parliamentary records, investigative outlets. An opinion piece counts only when it cites a documented fact.
4. act is one sentence, max 220 chars, specific: what was done, where, when.
5. category: war | genocide | repression | arms | extraction | impunity | climate | migration | finance | labour | media.
6. confidence 0-100: 90+ for a court finding or UN determination; 70s for multiple independent investigations; 50s for credible reporting; 35-49 for a single credible source. Below 35 do not include.
7. year is the year of the act, not the year of the article.
8. sources: at least one URL copied from the supplied results. Use two when they exist. Never invent a URL.
9. evidence_quote: a verbatim phrase from the supplied summary that supports the act, max 200 chars.
10. Return every distinct act. Do not stop at five. Merge duplicates instead of repeating them.
11. The same act may appear under several angles; return it only if this angle's results support it.

Return JSON only:
{"entries":[{"person":"","role":"","act":"","place":"","year":2024,"category":"finance","confidence":0,"sources":["https://..."],"evidence_quote":""}]}`;

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

interface Result {
  title: string;
  url: string;
  site: string;
  date: string | null;
  summary: string;
}

const normAct = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function researchDossierCase(
  config: ClockConfig,
  c: DossierCase,
): Promise<LedgerEntry[]> {
  const results: Result[] = [];
  const seen = new Set<string>();
  let answered = 0;

  for (const q of c.queries) {
    let data: { results?: Array<Record<string, unknown>> };
    try {
      data = await post<{ results?: Array<Record<string, unknown>> }>(
        `${config.searchBase}/v1/tools/search`,
        {
          query: `${q} lang:en after:${c.after} before:${c.before}`,
          count: 8,
          need_content: false,
        },
        config.searchKey,
        35_000,
      );
      answered += 1;
    } catch {
      // One slow query must not sink the whole look: the other five are
      // still evidence. If none answered, the pass failed and is retried.
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
        summary: String(r.summary).slice(0, 1000),
      });
    }
  }

  if (!answered) throw new Error("all searches failed");
  if (!results.length) return [];

  // Chunk the evidence so the model extracts acts instead of summarising a
  // wall of text. 32 results per call is roughly 30k characters.
  const chunks: Result[][] = [];
  for (let i = 0; i < results.length; i += 32) chunks.push(results.slice(i, i + 32));

  const entries: LedgerEntry[] = [];
  const seenActs = new Set<string>();

  for (const chunk of chunks) {
    const chat = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
      `${config.chatBase}/chat/completions`,
      {
        model: config.chatModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              subject: c.person,
              role: c.role,
              country: c.country,
              angle: c.angle,
              window: { after: c.after, before: c.before },
              results: chunk,
            }),
          },
        ],
      },
      config.chatKey,
      90_000,
    );

    const parsed = JSON.parse(chat.choices?.[0]?.message?.content || "{}") as {
      entries?: Array<Record<string, unknown>>;
    };

    for (const e of parsed.entries ?? []) {
      const person = String(e.person ?? c.person).trim().slice(0, 80);
      const act = String(e.act ?? "").trim().slice(0, 240);
      const sources = (Array.isArray(e.sources) ? e.sources : [])
        .map(String)
        .filter((s) => /^https?:\/\//.test(s));
      const confidence = Number(e.confidence);
      if (!person || !act || !sources.length) continue;
      if (!Number.isFinite(confidence) || confidence < 35) continue;
      // The rolling sweep is for this week's harm, not this week's insults.
      // Keep it to serious, current acts so the count stays a record and not
      // a clipping file.
      if (c.angle === "recent") {
        const year = Number(e.year) || 0;
        const category = String(e.category ?? "");
        if (confidence < 45 || category === "media") continue;
        if (year && year < new Date().getFullYear() - 1) continue;
      }
      const key = `${person.toLowerCase()}|${normAct(act)}`;
      if (seenActs.has(key)) continue;
      seenActs.add(key);
      entries.push({
        person,
        role: String(e.role ?? c.role).slice(0, 60),
        act,
        place: String(e.place ?? c.place).slice(0, 60),
        year: Number(e.year) || Number(c.after.slice(0, 4)),
        category: String(e.category ?? "extraction").slice(0, 20),
        confidence: Math.min(100, Math.round(confidence)),
        sources: sources.slice(0, 6),
        caseId: c.id,
      });
    }
  }

  return entries;
}
