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
6. Figures: only people EXPLICITLY named in the text who hold decision-making power over force — head of state or government, defence or interior minister, military commander, security-service chief, arms manufacturer executive. EXCLUDE critics, investigators, mediators, negotiators, aid workers, lawyers, witnesses, victims and human-rights officials. No inference. No private individuals. State only what the report says they did or ordered.
7. Every figure cites item_indices. No figure without items.
8. Name as many qualifying people as the text supports, up to 12. A thin list is a wasted pass.

Return JSON only:
{"items":[{"headline":"max 90 chars","fact":"1-2 sentences","quip":"max 140 chars","dimension":"war|civilian|repression|arms|incitement","harm":0,"source_index":0}],
 "figures":[{"name":"","role":"","country":"","reason":"one sentence, max 120 chars","item_indices":[0]}]}`;

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
            results: pool.slice(0, 24).map((c, index) => ({
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
    if (!cited.length) return [];
    const mean = cited.reduce((s, i) => s + i.harm, 0) / cited.length;
    return [
      {
        name,
        role: clip(f.role, 60),
        country: clip(f.country, 40),
        score: Math.round(shrink(mean, cited.length) * 10) / 10,
        mentions: cited.length,
        reason: clip(f.reason, 160),
        source: cited[0].source,
        sourceUrl: cited[0].sourceUrl,
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
