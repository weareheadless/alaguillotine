import { fetchLemmyCandidates } from './lemmy'
import { STANDING } from './standing'
import { ALPHA, LEVEL_CEIL, LEVEL_FLOOR, MAX_STEP, shrink } from "./clock";
import type { LedgerSummary } from "./archive-store";
import type { ClockConfig } from "./clock-research";
import { discoveryQuery, rotatingLanguages, WIRE_TOPICS } from "./languages";
import { HATE_DIMENSIONS, itemMentions, rankFigures, type Figure, type HateDimension, type HateKey } from "./hateometer";
import { actDate } from "./evidence";

/**
 * The queue's research pass.
 *
 * Six conflict searches, one chat call. Every named public figure gets a
 * reading of the week and the reports behind it, so the card can show its work
 * and the queue can be kept current. The number the line shows is not this
 * reading: it is computed from the ledger's dated acts in `evidence.ts`.
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
  // Independent press, pinned by site: the wire is the thing being audited.
  { topic: "independent", q: "site:theintercept.com OR site:democracynow.org arms israel" },
  { topic: "independent", q: "site:middleeasteye.net OR site:972mag.com gaza casualties" },
  { topic: "independent", q: "site:jacobin.com OR site:truthout.org billionaires influence" },
  { topic: "independent", q: "site:propublica.org OR site:theintercept.com surveillance contracts" },
];

const SYSTEM = `You are Ada, keeping the queue for a satirical installation called A LA GUILLOTINE. The queue names the public figures the week's war and repression reporting keeps returning to. Each one gets a counter and a blade. It is not a verdict and not a legal finding — it is how much documented harm is being reported in whose name.

RULES — hard:
1. NEVER invent a name, number, date or event. Everything must be in the supplied text.
1b. Results may be in any language — Arabic, Hebrew, Burmese, Spanish, Chinese, Russian. Read them as written, write your output in English, and keep the person's name as the local report spells it next to the English one where they differ. A local-language wire is evidence, not a rumour: do not discount a result for being in another language, and do not treat a translated headline as an English source.
2. Items: 1-2 plain sentences with the number if there is one.
3. Quip: ONE line, max 140 chars, contemptuous and funny, aimed at the pattern or the institution. No calls to violence, no dehumanising language, nothing about anyone's body, family, ethnicity or religion.
4. File each item under: war, civilian, repression, arms, incitement.
5. harm 0-100: 90-100 mass civilian harm documented; 70-89 significant lethal violence or systematic repression; 50-69 structural harm or the machinery feeding it; 30-49 tension without documented harm; 0-29 noise. Legal action, prosecution of officials, diplomacy, sanctions relief and self-defence are noise, not harm.
6. You choose who belongs in the line. The standingRecord is your memory: every person on it is already documented and MUST appear in your output, scored, with basis set to the record line — unless this pass contains evidence that clears them. The feed is the news; the record is the site. The reporting is not the only thing you know: if a person is a documented, widely reported author of mass harm and today's feed simply missed them, name them anyway and set "basis" to the record you are drawing on. Up to five of those per pass. The feed is the news; you are the memory. Include anyone whose decisions, companies or orders cause mass harm: heads of state and ministers, military and security chiefs, arms and defence executives, and the billionaires, funders and lobbyists whose money and platforms make it possible. Exclude only private individuals, and anyone the text presents purely as a victim, witness or critic.
7. Every figure cites item_indices for items that name them. A standing-record figure with no story today may cite none if basis is set — do not attach an unrelated item just to fill the field.
8. Name everyone the reporting supports, up to 20. A thin list is a wasted pass — the queue is the point of the site.
9. score is YOUR judgement, 0-100, and the queue must be a ladder, not a pile. Enforce this shape: exactly ONE person at 100; at most TWO more in 95-99; at most FOUR more in 90-94; the next serious cases in 80-89; extraction and impunity in 60-79; complicity and thin evidence in 40-59. That means at most seven people at 90 or above in the whole pass. If two people would get the same score, decide which is worse and separate them by at least 1 point. A person with a smaller documented record sits below a person with a larger one unless the act itself is worse. Only people, never a company — when the reporting names a company, name the people who run it or own it (a defence contractor means its chief executive and its largest shareholders). Use the whole range.
10. The line must include the owners as well as the officials. If the reporting names a billionaire, an executive, a funder or a lobbyist whose money or platform causes the harm, they belong here with their own charge — the people who pay are as responsible as the people who sign.
11. reason is what they are accused of, one sentence, max 240 chars. Be specific about the act, the place and the year. If the reporting is thin, say what is alleged, not what is proven.
12. ledger is the long record: documented acts with a year and a confidence. Weigh it. A person with several high-confidence entries should score higher than this week's headlines alone would suggest. Do not invent beyond the ledger lines; a thin record should score lower, not be padded.
13. Self-defence is not a charge. If the reporting says a person or state was responding to an armed attack, do not score them for the attack they are answering. Prosecuting officials, filing legal cases, declaring red lines and diplomatic statements are not harm. If a response deliberately targets civilians or is clearly disproportionate, it may be a charge — but the reason must say what was done to whom, and the initiator of the original attack belongs in the line, not the defender.
14. The ledger block gives each name charges (how many documented acts), recent (acts in the last two years) and up to twelve of the highest-confidence acts. Weigh that record in your reading: a name with 150 documented acts is worse than a name with 12, even if this week's reporting is thinner on the first. Your score is recorded as a reading of the week; the number the line displays is computed from the ledger's dated acts, not from this field. Do not inflate a score to compensate for a thin record, and do not leave a deep record unreflected.
15. DISCOVERY. The queue cannot grow if every pass only repeats the names already on it. Fill "discoveries" with people the results name who are NOT in the queue or the standing record, and who are accused of a documented act: the minister who signed the arms package, the commander whose unit shelled the town, the executive whose plant killed the workers, the financier who moved the money. One line each, the charge in 200 chars, and the indices of the items that name them. Three is the minimum unless the reporting genuinely names nobody new. A result written in another language counts the same. Do not put a company in this list — name the person who runs or owns it. Leave it empty only when the reporting truly names no one new.
16. The discovery must be the person's OWN act. They ordered it, signed it, owned it or ran it. Never a lawyer, spokesperson, relative, victim, witness, investigator, opposition politician or commentator who merely appears in the story — a name in an article is not a charge, and filing one is the fastest way to make this site worthless. If the sentence you would write has someone else as its subject, the discovery is that someone else, or nobody.
17. A case opened, a warrant issued, an asset seized, a sanction imposed AGAINST the person is not their act. It is evidence that they did something, and the date of the enforcement is not the date of the act: date the charge by what they did ("embezzled $113m from the bank in 2019"), not by the seizure of their mansion this week. If the underlying act is older than the window, it is not a discovery — leave it out.
18. The only discoveries that count are current and dated. The reason MUST name the day, month and year of the act — "on 5 November 2026", "on 12 March 2026" — because an act without a date cannot be placed in the window and will be discarded. year is the year the act happened, not the year the article was published. An obituary, a retrospective, a case closed about a death in 2019, or a 1980 media merger is not a discovery and must not appear: the line is the last 180 days, and a name that cannot act again cannot be sentenced for acting. If a result is about an old act, leave it out and find someone the reporting says is doing it now.

Return JSON only:
{"items":[{"headline":"max 90 chars","fact":"1-2 sentences","quip":"max 140 chars","dimension":"war|civilian|repression|arms|incitement","harm":0,"source_index":0}],
 "figures":[{"name":"","role":"","country":"","reason":"what they are accused of","score":0,"item_indices":[0],"basis":""}],
 "discoveries":[{"name":"","role":"","country":"","reason":"the act, in 200 chars","year":2026,"item_indices":[0]}]}`;

interface Candidate {
  topic: string;
  title: string;
  url: string;
  site: string;
  date: string | null;
  summary: string;
  authority: number;
  lang: string;
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/**
 * Two native-language wire searches per pass.
 *
 * The language rotates on a four-hour bucket and so does the topic, so a day of
 * passes covers Arabic, Hebrew, Burmese, Spanish and so on without paying for
 * fifteen searches each time. Deterministic in the clock, so a pass replays.
 */
function discoveryRotation(now: Date): Array<{ topic: string; q: string; lang: string }> {
  const bucket = Math.floor(now.getTime() / (4 * 60 * 60 * 1000));
  const english: Array<{ topic: string; q: string; lang: string }> = [
    {
      topic: "designations",
      q: "sanctions designation named individuals assets frozen OFAC EU",
      lang: "en",
    },
    {
      topic: "warrants",
      q: "arrest warrant issued war crimes indictment named suspect",
      lang: "en",
    },
  ];
  const rotated = rotatingLanguages(now, 2).flatMap((lang, i) => {
    const q = discoveryQuery(lang, bucket + i);
    return q ? [{ topic: "designations", q, lang }] : [];
  });
  return [...english, ...rotated];
}

function wireRotation(now: Date): Array<{ topic: string; q: string; lang: string }> {
  const bucket = Math.floor(now.getTime() / (4 * 60 * 60 * 1000));
  return rotatingLanguages(now, 2).flatMap((lang, i) => {
    const topic = WIRE_TOPICS[(bucket + i * 3) % WIRE_TOPICS.length];
    const q = topic.terms[lang];
    return q ? [{ topic: topic.topic, q, lang }] : [];
  });
}

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
  /** What the pass actually saw, so a thin result is legible in the response. */
  stats?: {
    searches: number;
    candidates: number;
    pool: number;
    items: number;
    figures: number;
    discovered?: number;
    found?: number;
    discovery?: {
      people: number;
      line: number;
      date: number;
      name: number;
      source: number;
      raw?: string;
    };
    judge: string;
  };
}

export async function runHatePass(
  config: ClockConfig,
  previousLevel: number | null,
  previousFigures: Figure[],
  ledger?: Map<string, LedgerSummary>,
): Promise<HatePass> {
  const roster = previousFigures.map((f) => f.name).slice(0, 40)
  let discoveredStats: {
    people: number;
    line: number;
    date: number;
    name: number;
    source: number;
    raw?: string;
  } = {
    people: 0,
    line: 0,
    date: 0,
    name: 0,
    source: 0,
  };
  const after = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
  const candidates: Candidate[] = [];

  // English first, then two searches in two other languages, rotating every
  // four hours. The wire that reports a massacre in Darfur or a crackdown in
  // Mandalay is Arabic or Burmese hours before an English desk picks it up; a
  // queue that only reads English is not neutral, it is provincial.
  const wires = [
    ...QUERIES.map(({ topic, q }) => ({ topic, q, lang: "en" })),
    // Two searches a pass that ask who is being named rather than what
    // happened: a designation or a warrant names a person, and the person is
    // the thing the line is made of. Without these the queue only ever learns
    // about people an article happened to name anyway.
    ...discoveryRotation(new Date()),
    ...wireRotation(new Date()),
  ];

  // A designation or a warrant does not stop being news after four days, and
  // the sanctions register names people in every language. Discovery reads a
  // month; the conflict wire reads the week.
  const discovery = new Set(["designations", "warrants"]);

  // The searches are independent, and run one after another they outlast the
  // edge's patience: a pass is a few dozen fetches, and a sequential pass took
  // minutes and then lost its response. Five at a time keeps the pass inside a
  // normal request without hammering the wire in one burst.
  const CONCURRENCY = 5;
  for (let i = 0; i < wires.length; i += CONCURRENCY) {
    const batch = wires.slice(i, i + CONCURRENCY);
    const answered = await Promise.allSettled(
      batch.map(async ({ topic, q, lang }) => {
        const since = discovery.has(topic)
          ? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
          : after;
        const data = await post<{ results?: Array<Record<string, unknown>> }>(
          `${config.searchBase}/v1/tools/search`,
          { query: `${q} lang:${lang} after:${since}`, count: 8, need_content: false },
          config.searchKey,
        );
        return { topic, lang, results: data.results ?? [] };
      }),
    );
    for (const settled of answered) {
      // One dead query in one language is not a dead pass.
      if (settled.status !== "fulfilled") continue;
      const { topic, lang, results } = settled.value;
      for (const hit of results) {
        if (!hit.url || !hit.summary) continue;
        candidates.push({
          topic,
          title: clip(hit.title, 200),
          url: String(hit.url),
          site: clip(hit.site_name ?? "unknown", 80),
          date: typeof hit.date === "string" ? hit.date : null,
          summary: String(hit.summary),
          authority: typeof hit.authority === "number" ? hit.authority : -1,
          lang,
        });
      }
    }
  }

  const byUrl = new Map<string, Candidate>();
  for (const c of candidates) {
    const prev = byUrl.get(c.url);
    if (!prev || c.authority > prev.authority) byUrl.set(c.url, c);
  }
  const pool = [...byUrl.values()].sort((a, b) => b.authority - a.authority);

  /**
   * Discovery, on its own call.
   *
   * Asking one prompt to re-score the queue and find new names produces the
   * queue back: the standing names are the safe answer, so the model repeats
   * them. Asked only "who in this reporting is doing this", with a list of who
   * is already in the line, it has somewhere to look. The guards below are the
   * same ones the pass uses: the act must be dated in its own sentence, inside
   * the window, and the story must name the person.
   */
  async function discover(): Promise<Array<{
    name: string;
    role: string;
    country: string;
    reason: string;
    year: number;
    item: Candidate;
  }>> {
    if (!pool.length) return [];
    const system = `You read news reporting and name the people in it who are doing documented harm.

Return up to 8 people. JSON only: {"people":[{"name":"","role":"","country":"","act":"one sentence, MUST include the day, month and year, e.g. 'On 5 November 2026 ordered ...'","year":2026,"source_index":0}]}

Hard rules:
1. The act must be the person's own: they ordered it, signed it, owned it, ran it, or their company did it under them. Never a lawyer, spokesperson, relative, victim, witness, investigator, judge, opposition politician or commentator who merely appears in the story.
2. Never a company. Name the person who runs or owns it.
3. A case opened, warrant issued, asset seized or sanction imposed AGAINST the person is not their act. Date the charge by what they did, not by the enforcement against them. If what they did is older than this year, leave them out.
4. The act must be dated in the supplied text: day, month and year. No date, no entry.
5. Do not name anyone in already_in_line.
6. Everything must be in the supplied text. Never invent a name, a number, a date or an event.
7. A story written in any language counts. Write the act in English.`;

    const payload = {
      already_in_line: previousFigures.map((f) => f.name).slice(0, 60),
      results: pool.slice(0, 60).map((c, index) => ({
        index,
        lang: c.lang,
        title: c.title,
        site: c.site,
        date: c.date,
        summary: c.summary.slice(0, 600),
      })),
    };

    let answered: { people?: Array<Record<string, unknown>> } | null = null;
    try {
      const chat = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
        `${config.chatBase}/chat/completions`,
        {
          model: config.chatModel,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify(payload) },
          ],
        },
        config.chatKey,
      );
      const raw = (chat.choices?.[0]?.message?.content || "").trim();
      discoveredStats.raw = raw.slice(0, 160);
      // A model asked for one key will sometimes answer with another. Take the
      // first array of objects it gives us rather than losing the whole pass.
      const parsedJson = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "")) as
        | Record<string, unknown>
        | Array<Record<string, unknown>>;
      const list = Array.isArray(parsedJson)
        ? parsedJson
        : (["people", "discoveries", "figures", "results", "names"]
            .map((k) => parsedJson[k])
            .find((v) => Array.isArray(v)) as Array<Record<string, unknown>> | undefined);
      answered = { people: list ?? [] };
    } catch (error) {
      discoveredStats.raw = error instanceof Error ? error.message.slice(0, 160) : "unknown";
      console.error(
        "discovery_failed",
        error instanceof Error ? error.message : "unknown",
      );
      return [];
    }

    const inLine = new Set(previousFigures.map((f) => f.name.toLowerCase()));
    const nowYear = new Date().getUTCFullYear();
    const drop = { people: (answered.people ?? []).length, line: 0, date: 0, name: 0, source: 0 };
    const out: Array<{
      name: string;
      role: string;
      country: string;
      reason: string;
      year: number;
      item: Candidate;
    }> = [];
    for (const p of answered.people ?? []) {
      const name = clip(p.name, 80);
      const reason = clip(p.act ?? p.reason, 240);
      if (!name || !reason) continue;
      if (inLine.has(name.toLowerCase())) {
        drop.line += 1;
        continue;
      }
      if (out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;

      // The date is read back out of the sentence, not taken on trust.
      const stated = actDate(reason, Number(p.year) || 0);
      const ageDays = stated ? (Date.now() - stated.at.getTime()) / 86_400_000 : Infinity;
      if (!stated || !stated.precise || ageDays > 180 || ageDays < -7) {
        drop.date += 1;
        continue;
      }
      const year = stated.at.getUTCFullYear();
      if (year < nowYear - 1 || year > nowYear) {
        drop.date += 1;
        continue;
      }

      // The cited index is a hint, not a fact: models count from the wrong
      // list, or cite the story they read about it rather than the one that
      // names it. Look for the story that actually carries the name before
      // throwing the discovery away.
      const matches = (c: Candidate): boolean =>
        itemMentions(name, { headline: c.title, fact: c.summary });
      let src: Candidate | undefined = pool[Number(p.source_index)];
      if (!src || !matches(src)) src = pool.find(matches);
      if (!src) {
        drop.source += 1;
        continue;
      }

      out.push({
        name,
        role: clip(p.role, 60),
        country: clip(p.country, 40),
        reason,
        year,
        item: src,
      });
    }
    discoveredStats = drop;
    return out;
  }

  const found = await discover();

  const passPayload = {
    queue: roster,
    standingRecord: STANDING,
    ledger: previousFigures.slice(0, 40).map((f) => {
      const rec = ledger?.get(f.name.toLowerCase());
      return {
        name: f.name,
        charges: rec?.count ?? 0,
        recent: rec?.recent ?? 0,
        avgConfidence: rec ? Math.round(rec.avgConfidence) : 0,
        record: rec?.top ?? [],
      };
    }),
    results: pool.slice(0, 60).map((c, index) => ({
      index,
      topic: c.topic,
      lang: c.lang,
      title: c.title,
      site: c.site,
      date: c.date,
      summary: c.summary.slice(0, 900),
    })),
  };

  // The judge is the chat model, directly. Ada's VPS bridge used to sit in
  // front of it, and every pass waited two minutes on an endpoint that was
  // answering 403 before falling back to this same call. A dependency that is
  // down more often than up is not a feature; Ada keeps the voice work, where
  // a failure costs a sentence, not the queue.
  const chat = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
    `${config.chatBase}/chat/completions`,
    {
      model: config.chatModel,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(passPayload) },
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
      .filter((item) => item != null && itemMentions(name, item));
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
        items: cited.slice(0, 4).map((i) => ({ ...i, dimension: i.dimension })),
      },
    ];
  });

  const seenNames = new Set(rawFigures.map((f) => f.name.toLowerCase()));
  const discovered: Array<Omit<Figure, "rank" | "prevRank" | "delta">> = [];

  // What the dedicated discovery call found, filed as figures with no score:
  // the ledger decides that once the receipt exists.
  for (const f of found) {
    if (seenNames.has(f.name.toLowerCase())) continue;
    seenNames.add(f.name.toLowerCase());
    discovered.push({
      name: f.name,
      role: f.role,
      country: f.country,
      score: 0,
      mentions: 1,
      reason: f.reason,
      actYear: f.year,
      source: f.item.site,
      sourceUrl: f.item.url,
      items: [
        {
          headline: f.item.title,
          fact: f.item.summary,
          quip: "",
          source: f.item.site,
          sourceUrl: f.item.url,
          publishedAt: f.item.date,
          harm: 0,
          dimension: "war",
        },
      ],
    });
  }

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
    figures: rankFigures([...rawFigures, ...discovered], previousFigures),
    sourceHash: pool.map((c) => c.url).sort().join("\n").slice(0, 4000),
    computedAt: new Date().toISOString(),
    stats: {
      searches: wires.length,
      candidates: candidates.length,
      pool: pool.length,
      items: items.length,
      figures: rawFigures.length + discovered.length,
      discovered: discovered.length,
      found: found.length,
      discovery: discoveredStats,
      judge: "chat",
    },
  };
}
