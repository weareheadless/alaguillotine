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

export function isStale(computedAt: string, now = Date.now()): boolean {
  return now - Date.parse(computedAt) > 24 * 60 * 60 * 1000
}
