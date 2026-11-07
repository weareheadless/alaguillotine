import { fetchLemmyCandidates } from './lemmy'
import { ALPHA, LEVEL_CEIL, LEVEL_FLOOR, MAX_STEP, shrink } from "./clock";
import type { ClockConfig } from "./clock-research";
import { HATE_DIMENSIONS, rankFigures, type Figure, type HateDimension, type HateKey } from "./hateometer";

/**
 * The queue's research pass.
 *
 * Six conflict searches, one chat call. Every named public figure gets their
 * own counter: the shrunk mean of the harm score of the reports that name them,
 * plus the reports themselves so the card can show its work.
 */

const QUERIES = [
  { topic: "strikes", q: "airstrike kills civilians casualties" },
  { topic: "ceasefire", q: "ceasefire talks collapse fighting resumes" },
  { topic: "arms", q: "military aid arms sale approved weapons package" },
  { topic: "crackdown", q: "protesters arrested crackdown emergency powers" },
  { topic: "justice", q: "war crimes arrest warrant investigation" },
  { topic: "displacement", q: "displaced famine siege humanitarian crisis" },
  { topic: "sanctions", q: "sanctions oligarch assets frozen" },
  { topic: "coup", q: "military coup junta seizes power" },
  { topic: "border", q: "border shelling civilians killed" },
  { topic: "surveillance", q: "police chief surveillance powers emergency law" },
  { topic: "orders", q: "president orders military response operation" },
  { topic: "orders", q: "minister announces crackdown security forces" },
  { topic: "orders", q: "prime minister defends arms sale parliament" },
  { topic: "orders", q: "defence minister approves weapons deal" },
];

const SYSTEM = `You are Ada, keeping the queue for a satirical installation called alaguillotine. The queue names the public figures the week's war and repression reporting keeps returning to. Each one gets a counter and a blade. It is not a verdict and not a legal finding — it is how much documented harm is being reported in whose name.

RULES — hard:
1. NEVER invent a name, number, date or event. Everything must be in the supplied text.
2. Items: 1-2 plain sentences with the number if there is one.
3. Quip: ONE line, max 140 chars, contemptuous and funny, aimed at the pattern or the institution. No calls to violence, no dehumanising language, nothing about anyone's body, family, ethnicity or religion.
4. File each item under: war, civilian, repression, arms, incitement.
5. harm 0-100: 90-100 mass civilian harm documented; 70-89 significant lethal violence or systematic repression; 50-69 structural harm or the machinery feeding it; 30-49 tension without documented harm; 0-29 noise.
6. You choose who belongs in the line. The reporting is not the only thing you know: if a person is a documented, widely reported author of mass harm and today's feed simply missed them, name them anyway and set "basis" to the record you are drawing on. Up to five of those per pass. The feed is the news; you are the memory. Include anyone whose decisions, companies or orders cause mass harm: heads of state and ministers, military and security chiefs, arms and defence executives, and the billionaires, funders and lobbyists whose money and platforms make it possible. Exclude only private individuals, and anyone the text presents purely as a victim, witness or critic.
7. Every figure cites item_indices. No figure without items.
8. Name everyone the reporting supports, up to 20. A thin list is a wasted pass — the queue is the point of the site.
9. score is YOUR judgement, 0-100, of how much this person deserves the blade. No formula overrules you and nothing is averaged. Only people, never a company — when the reporting names a company, name the people who run it or own it (a defence contractor means its chief executive and its largest shareholders). Scores must differ from each other — if everyone lands on 50 you have not decided. Use the whole range: 90+ for someone who ordered or bankrolled mass death, 70s for systematic cruelty with a body count, 50s for extraction and impunity, 30s for complicity.
10. The line must include the owners as well as the officials. If the reporting names a billionaire, an executive, a funder or a lobbyist whose money or platform causes the harm, they belong here with their own charge — the people who pay are as responsible as the people who sign.
11. reason is what they are accused of, one sentence, max 240 chars. Be specific about the act, the place and the year. If the reporting is thin, say what is alleged, not what is proven.

Return JSON only:
{"items":[{"headline":"max 90 chars","fact":"1-2 sentences","quip":"max 140 chars","dimension":"war|civilian|repression|arms|incitement","harm":0,"source_index":0}],
 "figures":[{"name":"","role":"","country":"","reason":"what they are accused of","score":0,"item_indices":[0],"basis":""}]}`;

interface Candidate {
  topic: string;
  title: string;
  url: string;
  site: string;
  date: string | null;
  summary: string;
  authority: number;
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

async function post<T>(url: string, body: unknown, key: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export interface HatePass {
  level: number;
  composite: number;
  dimensions: HateDimension[];
  figures: Figure[];
  sourceHash: string;
  computedAt: string;
}

export async function runHatePass(
  config: ClockConfig,
  previousLevel: number | null,
  previousFigures: Figure[],
): Promise<HatePass> {
  const roster = previousFigures.map((f) => f.name).slice(0, 40)
  const after = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
  const candidates: Candidate[] = [];

  for (const { topic, q } of QUERIES) {
    const data = await post<{ results?: Array<Record<string, unknown>> }>(
      `${config.searchBase}/v1/tools/search`,
      { query: `${q} lang:en after:${after}`, count: 5, need_content: false },
      config.searchKey,
    );
    for (const hit of data.results ?? []) {
      if (!hit.url || !hit.summary) continue;
      candidates.push({
        topic,
        title: clip(hit.title, 200),
        url: String(hit.url),
        site: clip(hit.site_name ?? "unknown", 80),
        date: typeof hit.date === "string" ? hit.date : null,
        summary: String(hit.summary),
        authority: typeof hit.authority === "number" ? hit.authority : -1,
      });
    }
  }

  const byUrl = new Map<string, Candidate>();
  for (const c of candidates) {
    const prev = byUrl.get(c.url);
    if (!prev || c.authority > prev.authority) byUrl.set(c.url, c);
  }
  const pool = [...byUrl.values()].sort((a, b) => b.authority - a.authority);

  const chat = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
    `${config.chatBase}/chat/completions`,
    {
      model: config.chatModel,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            queue: roster,
            results: pool.slice(0, 40).map((c, index) => ({
              index,
              topic: c.topic,
              title: c.title,
              site: c.site,
              date: c.date,
              summary: c.summary.slice(0, 900),
            })),
          }),
        },
      ],
    },
    config.chatKey,
  );

  const parsed = JSON.parse(chat.choices?.[0]?.message?.content || "{}") as {
    items?: Array<Record<string, unknown>>;
    figures?: Array<Record<string, unknown>>;
  };
  const valid = new Set(HATE_DIMENSIONS.map((d) => d.key));

  const items = (parsed.items ?? []).flatMap((item, i) => {
    const src = pool[Number(item.source_index)];
    if (!src) return [];
    const harm = Number(item.harm);
    const key = String(item.dimension);
    const entry = {
      id: `${src.url}:${i}`.slice(-24),
      headline: clip(item.headline || src.title, 120),
      fact: clip(item.fact, 400),
      quip: clip(item.quip, 160),
      source: src.site,
      sourceUrl: src.url,
      publishedAt: src.date,
      harm: Number.isFinite(harm) ? Math.max(0, Math.min(100, Math.round(harm))) : 40,
      dimension: (valid.has(key as HateKey) ? key : "war") as HateKey,
    };
    return entry.headline && entry.fact ? [entry] : [];
  });

  const rawFigures = (parsed.figures ?? []).flatMap((f) => {
    const name = clip(f.name, 80);
    if (!name) return [];
    const cited = (Array.isArray(f.item_indices) ? f.item_indices : [])
      .map((i) => items[Number(i)])
      .filter(Boolean);
    // No article today is not a reason to forget a documented record.
    if (!cited.length && !clip(f.basis, 200)) return [];
    const given = Number(f.score);
    return [
      {
        name,
        role: clip(f.role, 60),
        country: clip(f.country, 40),
        score: Number.isFinite(given) ? Math.max(0, Math.min(100, Math.round(given))) : 50,
        mentions: cited.length,
        reason: clip(f.reason, 240),
        source: cited[0]?.source ?? "ada's record",
        sourceUrl:
          cited[0]?.sourceUrl ??
          `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(name)}`,
        items: cited.slice(0, 4),
      },
    ];
  });

  const dimensions: HateDimension[] = HATE_DIMENSIONS.map((spec) => {
    const mine = items.filter((i) => i.dimension === spec.key);
    const mean = mine.length ? mine.reduce((s, i) => s + i.harm, 0) / mine.length : 50;
    return {
      key: spec.key,
      label: spec.label,
      weight: spec.weight,
      score: Math.round(shrink(mean, mine.length) * 10) / 10,
      evidence: mine.length,
    };
  });

  const composite =
    Math.round(dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) * 100) / 100;
  const raw =
    previousLevel === null ? composite : previousLevel + ALPHA * (composite - previousLevel);
  const stepped =
    previousLevel === null
      ? raw
      : Math.max(previousLevel - MAX_STEP, Math.min(previousLevel + MAX_STEP, raw));
  const level = Math.round(Math.max(LEVEL_FLOOR, Math.min(LEVEL_CEIL, stepped)) * 100) / 100;

  return {
    level,
    composite,
    dimensions,
    figures: rankFigures(rawFigures, previousFigures),
    sourceHash: pool.map((c) => c.url).sort().join("\n").slice(0, 4000),
    computedAt: new Date().toISOString(),
  };
}
