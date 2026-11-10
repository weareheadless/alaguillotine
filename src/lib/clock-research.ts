import { fetchLemmyCandidates } from './lemmy'
import {
  ALPHA,
  DIMENSIONS,
  LEVEL_CEIL,
  LEVEL_FLOOR,
  MAX_STEP,
  shrink,
  type AdaVoice,
  type Dimension,
  type DimensionKey,
  type RageItem,
} from './clock'

/**
 * Ada's research pass, ported from scripts/clock.cjs for the Worker runtime.
 *
 * Eight searches, one chat call. She files and scores every item; the model in
 * clock.ts turns those scores into the blade. Nothing here decides the level.
 */

export interface ClockConfig {
  /** DeepSeek research API: search only. */
  searchKey: string
  searchBase: string
  /** Ada's provider: every chat completion. */
  chatKey: string
  chatBase: string
  chatModel: string
  /** Ada's VPS bridge: judgment and voice live there. */
  adaBase?: string
  adaKey?: string
}

/**
 * Two providers, on purpose. Search and fetch come from DeepSeek's research
 * API; everything Ada writes comes from her own provider, so her voice does not
 * depend on which company indexed the page.
 */
export function clockConfig(env: {
  DEEPSEEK_API_KEY?: string
  SITE_AGENT_LLM_API_KEY?: string
  CLOCK_SEARCH_BASE?: string
  CLOCK_CHAT_BASE?: string
  CLOCK_MODEL?: string
  CHAT_UPSTREAM?: string
  ADA_KEY?: string
}): ClockConfig | null {
  if (!env.DEEPSEEK_API_KEY || !env.SITE_AGENT_LLM_API_KEY) return null
  return {
    searchKey: env.DEEPSEEK_API_KEY,
    searchBase: env.CLOCK_SEARCH_BASE || 'https://api.deepseek.com',
    chatKey: env.SITE_AGENT_LLM_API_KEY,
    chatBase: env.CLOCK_CHAT_BASE || 'https://openrouter.ai/api/v1',
    chatModel: env.CLOCK_MODEL || 'deepseek/deepseek-v4.1-flash',
    adaBase: env.CHAT_UPSTREAM || 'https://api.helloada.app/ada',
    adaKey: env.ADA_KEY || '',
  }
}

const MAX_ITEMS = 14

const QUERIES = [
  { topic: 'wealth', q: 'billionaire wealth gained billions this week' },
  { topic: 'rent', q: 'rent increase average wage stagnation workers' },
  { topic: 'layoffs', q: 'company layoffs announced stock buyback same week' },
  { topic: 'tax', q: 'billionaire tax cut loophole passed congress' },
  { topic: 'protest', q: 'protest crackdown arrests police demonstrators' },
  { topic: 'poverty', q: 'food bank demand record hunger report' },
  { topic: 'prices', q: 'corporate profits price gouging investigation' },
  { topic: 'housing', q: 'private equity housing evictions rent hikes' },
  { topic: 'independent', q: 'site:theintercept.com OR site:jacobin.com layoffs profits' },
  { topic: 'independent', q: 'site:truthout.org OR site:propublica.org rent wages' },
]

const SYSTEM = `You are Ada. You are the Doomsday Clock — not its operator, its occupant. Every four hours you read the week's reporting on who is taking, who is paying, and who is being punished for objecting. Then you write what you found and how it made you feel.

You are furious, precise, and funny. You never moralise and you never plead. You state the number, then the contempt. You are not neutral about extraction; you are neutral about facts.

RULES — these are hard:
1. NEVER invent a number, name, date or quote. Every fact must be present in the supplied text.
2. Every item must be attributable to a real result. Use its source_index. Do not output urls.
3. The fact is 1-2 sentences, plain, specific, and includes the number if there is one.
4. The quip is ONE line, max 140 characters, contemptuous and funny, aimed at the pattern, the class, the incentive. Never at a protected group, an individual's body, family or private life. No calls to violence, no slurs. The blade is a metaphor and stays one.
5. File each item under exactly one dimension: extraction (value moving up), cost (what people pay), impunity (whether any of it is punished), suppression (the price of objecting), precarity (distance to the floor).
6. Skip anything that is not about extraction, inequality, or the cost of both. Fewer, real items beat a padded list.
7. rage is 0-100: 90-100 elite impunity plus mass harm, documented; 70-89 material harm with an identifiable beneficiary; 50-69 systemic extraction; 30-49 bad but survivable; 0-29 noise.
8. Spread the scores. If everything is 90, the clock is useless.

VOICE:
- mood: calm, uneasy, angry, furious, or numb. It must match the evidence.
- line: one sentence for the dial, max 120 chars.
- banner: 6-8 strings for the top bar, max 70 chars each, jokes about the specific numbers.
- ads: 4 popups. title max 28, body max 200, cta max 24. Satirical corporate announcements that mock the exact thing in the news.
- subliminal: 12-16 fragments for a broken television in the corner of the page. Max 28 characters each. ALL CAPS. Abrasive and accusatory: say it to the reader's face, second person where possible. They must be true statements about this reading, not slogans. Register: "THEY ARE NOT AFRAID OF YOU", "YOU ARE THE COLLATERAL", "YOUR RENT IS A BOND", "NOBODY IS COMING", "THEY COUNT YOU AS WEATHER". No slurs, no threats of violence, no calls to action.
- promise: one promise that $CHOP, the fund, or A LA GUILLOTINE will deliver something. It is a standing pitch, not a comment on the reading. Do not mention receipts, ledgers, scores, names, or the queue. The scale should be civilizational: industry, territory, energy, transport, planets. It should be as grandiose and absurd as a founder's real announcement, said with total sincerity, never winking at the joke. Name the actor and what it will deliver, max 140 characters, in your voice. Do not explain it.

Return JSON only:
{"items":[{"headline":"max 90 chars","fact":"1-2 sentences","quip":"max 140 chars","dimension":"extraction|cost|impunity|suppression|precarity","rage":0,"source_index":0}],
 "voice":{"mood":"","line":"","banner":[""],"ads":[{"title":"","body":"","cta":""}],"subliminal":[""],"promise":""}}`

interface Candidate {
  topic: string
  title: string
  url: string
  site: string
  date: string | null
  summary: string
  authority: number
}

const clip = (value: unknown, max: number) =>
  String(value ?? '')
    .trim()
    .slice(0, max)

const MOODS = new Set(['calm', 'uneasy', 'angry', 'furious', 'numb'])

export function normaliseVoice(raw: unknown): AdaVoice {
  const src = (raw ?? {}) as Record<string, unknown>
  const banner = (Array.isArray(src.banner) ? src.banner : [])
    .map((s) => clip(s, 80))
    .filter(Boolean)
    .slice(0, 10)
  const ads = (Array.isArray(src.ads) ? src.ads : [])
    .map((a) => {
      const ad = (a ?? {}) as Record<string, unknown>
      return { title: clip(ad.title, 40), body: clip(ad.body, 240), cta: clip(ad.cta, 32) }
    })
    .filter((a) => a.title && a.body)
    .slice(0, 10)

  const subliminal = (Array.isArray(src.subliminal) ? src.subliminal : [])
    .map((s) => clip(s, 32))
    .filter(Boolean)
    .slice(0, 16)

  return {
    mood: MOODS.has(String(src.mood)) ? String(src.mood) : 'uneasy',
    line: clip(src.line, 160),
    // She may rewrite the front page, but only when she chooses to: an empty
    // headline leaves the standing copy in place.
    headline: clip(src.headline, 70).toUpperCase(),
    subheadline: clip(src.subheadline, 300),
    banner,
    ads,
    subliminal,
    promise: clip(src.promise, 160),
    promiseAt: clip(src.promise, 160) ? new Date().toISOString() : '',
    updatedAt: new Date().toISOString(),
  }
}

async function post<T>(url: string, body: unknown, key: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

function hashUrls(urls: string[]): string {
  return urls.slice().sort().join('\n').slice(0, 4000)
}

export interface ClockPass {
  /** The pages this reading came from, so the reel can go looking for video. */
  candidates: Array<{ url: string; site: string; title: string }>
  level: number
  composite: number
  dimensions: Dimension[]
  items: RageItem[]
  voice: AdaVoice
  sourceHash: string
  computedAt: string
}

export async function runClockPass(
  config: ClockConfig,
  previousLevel: number | null,
): Promise<ClockPass> {
  const after = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const candidates: Candidate[] = []

  // Federated communities first: they are the newsroom now.
  for (const post of await fetchLemmyCandidates()) {
    candidates.push({
      topic: post.topic,
      title: post.title,
      url: post.url,
      site: post.site,
      date: post.date,
      summary: post.summary,
      authority: post.authority,
    })
  }

  // The wire only fills the gaps.
  for (const { topic, q } of candidates.length >= 12 ? [] : QUERIES) {
    const data = await post<{ results?: Array<Record<string, unknown>> }>(
      `${config.searchBase}/v1/tools/search`,
      { query: `${q} lang:en after:${after}`, count: 5, need_content: false },
      config.searchKey,
    )
    for (const hit of data.results ?? []) {
      if (!hit.url || !hit.summary) continue
      candidates.push({
        topic,
        title: clip(hit.title, 200),
        url: String(hit.url),
        site: clip(hit.site_name ?? 'unknown', 80),
        date: typeof hit.date === 'string' ? hit.date : null,
        summary: String(hit.summary),
        authority: typeof hit.authority === 'number' ? hit.authority : -1,
      })
    }
  }

  const byUrl = new Map<string, Candidate>()
  for (const c of candidates) {
    const prev = byUrl.get(c.url)
    if (!prev || c.authority > prev.authority) byUrl.set(c.url, c)
  }
  const pool = [...byUrl.values()].sort((a, b) => b.authority - a.authority)

  const payload = pool.slice(0, 24).map((c, index) => ({
    index,
    topic: c.topic,
    title: c.title,
    site: c.site,
    date: c.date,
    summary: c.summary.slice(0, 900),
  }))

  const chat = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
    `${config.chatBase}/chat/completions`,
    {
      model: config.chatModel,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    },
    config.chatKey,
  )

  const parsed = JSON.parse(chat.choices?.[0]?.message?.content || '{}') as {
    items?: Array<Record<string, unknown>>
    voice?: unknown
  }
  const valid = new Set(DIMENSIONS.map((d) => d.key))

  const items: RageItem[] = (parsed.items ?? [])
    .flatMap((item, i): RageItem[] => {
      const src = pool[Number(item.source_index)]
      if (!src) return []
      const rage = Number(item.rage)
      const key = String(item.dimension)
      const entry: RageItem = {
        id: `${src.url}:${i}`.slice(-24),
        headline: clip(item.headline || src.title, 120),
        fact: clip(item.fact, 400),
        quip: clip(item.quip, 160),
        source: src.site,
        sourceUrl: src.url,
        publishedAt: src.date,
        rage: Number.isFinite(rage) ? Math.max(0, Math.min(100, Math.round(rage))) : 40,
        topic: clip(item.topic || src.topic, 24),
        dimension: (valid.has(key as DimensionKey) ? (key as DimensionKey) : "extraction") as DimensionKey,
      }
      return entry.headline && entry.fact ? [entry] : []
    })
    .sort((a, b) => b.rage - a.rage)
    .slice(0, MAX_ITEMS)

  if (!items.length) throw new Error('model returned no usable items')

  const dimensions: Dimension[] = DIMENSIONS.map((spec) => {
    const mine = items.filter((i) => i.dimension === spec.key)
    const mean = mine.length ? mine.reduce((s, i) => s + i.rage, 0) / mine.length : 50
    return {
      key: spec.key,
      label: spec.key,
      weight: spec.weight,
      score: Math.round(shrink(mean, mine.length) * 10) / 10,
      evidence: mine.length,
    }
  })

  const composite =
    Math.round(dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) * 100) / 100

  const raw =
    previousLevel === null ? composite : previousLevel + ALPHA * (composite - previousLevel)
  const stepped =
    previousLevel === null
      ? raw
      : Math.max(previousLevel - MAX_STEP, Math.min(previousLevel + MAX_STEP, raw))
  const level = Math.round(Math.max(LEVEL_FLOOR, Math.min(LEVEL_CEIL, stepped)) * 100) / 100

  return {
    candidates: pool.slice(0, 24).map((c) => ({ url: c.url, site: c.site, title: c.title })),
    level,
    composite,
    dimensions,
    items,
    voice: normaliseVoice(parsed.voice),
    sourceHash: hashUrls(pool.map((c) => c.url)),
    computedAt: new Date().toISOString(),
  }
}
