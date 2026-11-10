import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Dimension, RageItem, AdaVoice } from './clock'

/**
 * D1 access for the clock.
 *
 * The stored row holds the model inputs (level, composite, dimensions, items,
 * voice). Everything the UI shows is derived from those in the route handler, so
 * the dial can never disagree with the data behind it.
 */

type D1Result = { results?: Array<Record<string, unknown>> }
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement
  first: <T = Record<string, unknown>>() => Promise<T | null>
  run: () => Promise<unknown>
  all: <T = D1Result>() => Promise<T>
}
export type D1 = { prepare: (query: string) => D1Statement }

export async function getDb(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 }
  }
  return context.env?.D1 ?? null
}

export interface ClockRow {
  level: number
  composite: number
  dimensions: Dimension[]
  items: RageItem[]
  voice: AdaVoice
  sourceHash: string | null
  computedAt: string
}

const parse = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function readClock(db: D1): Promise<ClockRow | null> {
  const row = await db
    .prepare(
      'SELECT level, composite, dimensions, items, voice, source_hash, computed_at FROM clock_readings WHERE id = ?',
    )
    .bind('current')
    .first<Record<string, unknown>>()
  if (!row) return null
  return {
    level: Number(row.level),
    composite: Number(row.composite),
    dimensions: parse<Dimension[]>(row.dimensions, []),
    items: parse<RageItem[]>(row.items, []),
    voice: parse<AdaVoice>(row.voice, {
      mood: 'numb',
      line: '',
      banner: [],
      ads: [],
      subliminal: [],
      updatedAt: null,
    }),
    sourceHash: typeof row.source_hash === 'string' ? row.source_hash : null,
    computedAt: String(row.computed_at),
  }
}

export async function writeClock(db: D1, row: ClockRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO clock_readings (id, level, composite, dimensions, items, voice, source_hash, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         level = excluded.level,
         composite = excluded.composite,
         dimensions = excluded.dimensions,
         items = excluded.items,
         voice = excluded.voice,
         source_hash = excluded.source_hash,
         computed_at = excluded.computed_at`,
    )
    .bind(
      'current',
      row.level,
      row.composite,
      JSON.stringify(row.dimensions),
      JSON.stringify(row.items),
      JSON.stringify(row.voice),
      row.sourceHash,
      row.computedAt,
    )
    .run()
}

/**
 * The popup pool.
 *
 * Each reading writes four or five ads; keeping only the latest set makes the
 * page repeat itself within a day. The pool keeps a week of them, deduped by
 * their text, so the stack can draw on a wider vocabulary of interruptions.
 */
const adId = (ad: { title: string; body: string }) => {
  const s = `${ad.title}|${ad.body}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  let h = 5381
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `ad:${(h >>> 0).toString(36)}`
}

export async function rememberAds(db: D1, ads: AdaVoice['ads']): Promise<void> {
  if (!ads.length) return
  const now = new Date().toISOString()
  for (const ad of ads) {
    await db
      .prepare(
        `INSERT INTO voice_ads (id, title, body, cta, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET created_at = excluded.created_at`,
      )
      .bind(adId(ad), ad.title, ad.body, ad.cta, now)
      .run()
  }
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString()
  await db.prepare('DELETE FROM voice_ads WHERE created_at < ?').bind(cutoff).run()
}

export async function readAdPool(db: D1, limit = 80): Promise<AdaVoice['ads']> {
  const rows = await db
    .prepare('SELECT title, body, cta FROM voice_ads ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all()
  return (rows.results ?? [])
    .map((r) => ({
      title: String(r.title ?? ''),
      body: String(r.body ?? ''),
      cta: String(r.cta ?? ''),
    }))
    .filter((a) => a.title && a.body)
}

export function isStale(computedAt: string, now = Date.now()): boolean {
  return now - Date.parse(computedAt) > 24 * 60 * 60 * 1000
}
