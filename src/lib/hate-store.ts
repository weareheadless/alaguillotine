import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Figure, HateDimension } from "./hateometer";
import { slugify } from "./slug";
import { samePerson } from "./person-name";
import { ledgerSummaryFor, readLedgerSummaries } from "./archive-store";
import { COOLDOWN_DAYS, SENTENCE_BAND } from "./evidence";
import { sentenceSlot } from "./schedule";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
  all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
};
export type D1 = {
  prepare: (query: string) => D1Statement;
  batch?: (statements: D1Statement[]) => Promise<unknown>;
};

export async function getDb(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { D1?: D1 };
  };
  return context.env?.D1 ?? null;
}

export interface HateRow {
  level: number;
  composite: number;
  dimensions: HateDimension[];
  figures: Figure[];
  sourceHash: string | null;
  computedAt: string;
}

const parse = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export async function readHate(db: D1): Promise<HateRow | null> {
  const row = await db
    .prepare(
      "SELECT level, composite, dimensions, figures, source_hash, computed_at FROM hate_readings WHERE id = ?",
    )
    .bind("current")
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    level: Number(row.level),
    composite: Number(row.composite),
    dimensions: parse<HateDimension[]>(row.dimensions, []),
    figures: parse<Figure[]>(row.figures, []),
    sourceHash: typeof row.source_hash === "string" ? row.source_hash : null,
    computedAt: String(row.computed_at),
  };
}

export async function writeHate(db: D1, row: HateRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO hate_readings (id, level, composite, dimensions, items, figures, source_hash, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         level = excluded.level,
         composite = excluded.composite,
         dimensions = excluded.dimensions,
         items = excluded.items,
         figures = excluded.figures,
         source_hash = excluded.source_hash,
         computed_at = excluded.computed_at`,
    )
    .bind(
      "current",
      row.level,
      row.composite,
      JSON.stringify(row.dimensions),
      JSON.stringify([]),
      JSON.stringify(row.figures),
      row.sourceHash,
      row.computedAt,
    )
    .run();
}

const FIGURE_COLUMNS =
  "name, slug, role, country, reason, score, mentions, rank, prev_rank, added_at, last_seen_at, dropped_at, items, source, source_url, times_chopped, record_bonus";

function rowToFigure(r: Record<string, unknown>): Figure {
  return {
    name: String(r.name),
    slug: String(r.slug ?? ""),
    role: String(r.role ?? ""),
    country: String(r.country ?? ""),
    score: Number(r.score),
    mentions: Number(r.mentions),
    reason: String(r.reason ?? ""),
    source: String(r.source ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    items: parse<Figure["items"]>(r.items, []),
    rank: Number(r.rank),
    prevRank: r.prev_rank == null ? null : Number(r.prev_rank),
    delta: r.prev_rank == null ? null : Number(r.prev_rank) - Number(r.rank),
    addedAt: String(r.added_at),
    // A chop is a tally, not an exit: nobody is ever off the line.
    droppedAt: null,
    timesChopped: Number(r.times_chopped ?? 0),
    recordBonus: Number(r.record_bonus ?? 0),
  };
}

/** The queue persists across passes: Ada adds people, they stay. */
export async function readQueue(db: D1): Promise<Figure[]> {
  const [rows, chops] = await Promise.all([
    db.prepare(`SELECT ${FIGURE_COLUMNS} FROM queue_people ORDER BY rank ASC`).all(),
    db
      .prepare("SELECT slug, MAX(chopped_at) AS last FROM chop_events GROUP BY slug")
      .all()
      .catch(() => ({ results: [] as Array<Record<string, unknown>> })),
  ]);

  const lastChop = new Map<string, string>();
  for (const c of chops.results ?? []) {
    if (c.slug && c.last) lastChop.set(String(c.slug), String(c.last));
  }

  // The line is ordered by the record, and a name serving its three days is at
  // the foot of it. The score does not change — the record did not change, and
  // a chop is a tally, not a reset — but the slot does: the blade has just been
  // through, so the line moves on without pretending the number fell.
  const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const cooling = (f: Figure): boolean => {
    const at = Date.parse(String(f.lastChoppedAt ?? ""));
    return Number.isFinite(at) && at >= cutoff;
  };

  return (rows.results ?? [])
    .map((r) => {
      const figure = rowToFigure(r);
      const last = lastChop.get(slugify(figure.name));
      return last ? { ...figure, lastChoppedAt: last } : figure;
    })
    .sort((a, b) => {
      const ca = cooling(a) ? 1 : 0;
      const cb = cooling(b) ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return b.score - a.score || b.mentions - a.mentions;
    })
    .map((f, i) => {
      const rank = i + 1;
      return {
        ...f,
        prevRank: f.rank,
        rank,
        delta: f.rank - rank,
      };
    });
}

/**
 * The slug is a door, and a name can have two: the queue writes one when the
 * name joins the line, and a claim writes one when a finding is filed. A
 * finding that spells the name longer — "Donald J. Trump" for "Donald Trump" —
 * must not open a second page, or half the record sits behind a URL nobody
 * links to. Both slugs resolve to the queue row.
 */
async function queueRowForEntitySlug(
  db: D1,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const entity = await db
    .prepare("SELECT name FROM entities WHERE slug = ? AND kind = 'person' LIMIT 1")
    .bind(slug)
    .first<{ name: string }>();
  if (!entity?.name) return null;

  const queue = await db.prepare("SELECT slug, name FROM queue_people").all();
  const match = (queue.results ?? []).find(
    (row) => row.name && samePerson(String(row.name), String(entity.name)),
  );
  if (!match?.slug) return null;

  return db
    .prepare(`SELECT ${FIGURE_COLUMNS} FROM queue_people WHERE slug = ?`)
    .bind(String(match.slug))
    .first<Record<string, unknown>>();
}

/** One name, with its chop tally and the last time the blade fell. */
export async function getPersonBySlug(slug: string): Promise<Figure | null> {
  const db = await getDb();
  if (!db) return null;

  // A page is a seat in the line. Everything else the record holds — a finding,
  // a charge, a vote — is read in the archive, one query over the claims that
  // cannot disagree with itself. A name without a queue row gets no page here;
  // the caller sends it to the archive instead.
  const row =
    (await db
      .prepare(`SELECT ${FIGURE_COLUMNS} FROM queue_people WHERE slug = ?`)
      .bind(slug)
      .first<Record<string, unknown>>()) ?? (await queueRowForEntitySlug(db, slug));

  if (!row) return null;

  const figure = rowToFigure(row);
  figure.slug = String(row.slug ?? slug);

  // The stored rank is from the last research pass; a chop moves the line, so
  // show the rank the name holds right now.
  try {
    const queue = await readQueue(db);
    const live = queue.find((p) => p.name.toLowerCase() === figure.name.toLowerCase());
    if (live) figure.rank = live.rank;
  } catch {
    /* keep the stored rank */
  }

  try {
    const chops = await db
      .prepare(
        "SELECT COUNT(*) AS n, MAX(chopped_at) AS last FROM chop_events WHERE slug = ?",
      )
      .bind(figure.slug)
      .first<Record<string, unknown>>();
    figure.timesChopped = Number(chops?.n ?? figure.timesChopped ?? 0);
    figure.lastChoppedAt = chops?.last == null ? null : String(chops.last);
  } catch {
    figure.lastChoppedAt = null;
  }

  // The page links back to the same claims in the archive, filtered to this
  // person, so the two views cannot drift apart in the reader's hands.
  try {
    figure.entityId = await entityIdForName(db, figure.name);
  } catch {
    /* the page still renders without the link */
  }

  // The page has to show the same window the number is scored on, or it will
  // say "no open acts" under a score the ledger produced.
  try {
    const summaries = await readLedgerSummaries();
    const summary = ledgerSummaryFor(summaries, figure.name);
    figure.windowActs = summary?.windowActs ?? 0;
    figure.latestAct = summary?.newest ?? null;
    figure.topCharges = summary?.top ?? [];
  } catch {
    /* the row still renders without the receipt */
  }

  return figure;
}

/**
 * The entity the claims are filed under for this name, when one exists.
 *
 * The person page and the archive both need it: the archive filters by it, and
 * the page uses it for the link back to the full record.
 */
export async function entityIdForName(db: D1, name: string): Promise<string> {
  const rows = await db.prepare("SELECT id, name FROM entities WHERE kind = 'person'").all();
  const hit = (rows.results ?? []).find(
    (row) => row.name && samePerson(String(row.name), name),
  );
  return hit ? String(hit.id) : "";
}

/** The line's slug for a name, or null when the name has no seat. */
export async function lineSlugFor(name: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.prepare("SELECT slug, name FROM queue_people").all();
  const hit = (rows.results ?? []).find(
    (row) => row.name && samePerson(String(row.name), name),
  );
  return hit?.slug ? String(hit.slug) : null;
}

/**
 * Where a name without a page is read: the archive, filtered to that record.
 *
 * The URL keeps working and the content stays reachable; the page itself is
 * kept for a name standing in the line, so "the person page" means one thing.
 */
export async function archiveHrefForSlug(slug: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const entity = await db
    .prepare("SELECT id FROM entities WHERE slug = ? AND kind = 'person' LIMIT 1")
    .bind(slug)
    .first<{ id: string }>();
  if (entity?.id) return `/archive?entity=${encodeURIComponent(String(entity.id))}`;

  // The legacy ledger filed names without an entity. Match the two spellings
  // the old page matched — exact, then first-and-last — so no link is lost.
  const rows = await db.prepare("SELECT DISTINCT person FROM ledger_entries").all();
  const loose = (person: string): string => {
    const parts = String(person)
      .replace(/["“”]/g, "")
      .split(/\s+/)
      .filter((w) => !/^[A-Z]\.$/.test(w) && !/^Jr\.?$|^Sr\.?$|^III$|^II$/i.test(w));
    return slugify(parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : person);
  };
  const name = (rows.results ?? [])
    .map((row) => String(row.person ?? ""))
    .find((person) => person && (slugify(person) === slug || loose(person) === slug));
  return name ? `/archive?q=${encodeURIComponent(name)}` : null;
}

export async function writeQueue(db: D1, people: Figure[]): Promise<void> {
  for (const p of people) {
    await db
      .prepare(
        `INSERT INTO queue_people (id, name, slug, role, country, reason, score, mentions, rank, prev_rank, added_at, last_seen_at, dropped_at, items, source, source_url, record_bonus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           role = excluded.role,
           country = excluded.country,
           reason = excluded.reason,
           -- The score is the ledger inside the window. Being chopped does not
           -- reset it and does not add anything: the record did not change, so
           -- the number must not either. A cooldown keeps the blade moving.
           score = excluded.score,
           mentions = excluded.mentions,
           prev_rank = queue_people.rank,
           rank = excluded.rank,
           last_seen_at = excluded.last_seen_at,
           dropped_at = COALESCE(queue_people.dropped_at, excluded.dropped_at),
           items = excluded.items,
           source = excluded.source,
           source_url = excluded.source_url,
           record_bonus = excluded.record_bonus`,
      )
      .bind(
        slugify(p.name),
        p.name,
        slugify(p.name),
        p.role,
        p.country,
        p.reason,
        p.score,
        p.mentions,
        p.rank,
        p.prevRank,
        p.addedAt ?? new Date().toISOString(),
        new Date().toISOString(),
        p.droppedAt ?? null,
        JSON.stringify(p.items),
        p.source,
        p.sourceUrl,
        p.recordBonus ?? 0,
      )
      .run();
  }
}

/**
 * Put the queue's numbers back in step with the record, without waiting for
 * the research pass.
 *
 * A name discovery adds, or an act the name pass files, changes the record the
 * score is computed from. Leaving the old number in place means the archive
 * shows an act that the blade has not counted: the page says zero beside a
 * person with a charge, and the line orders them as if nothing happened. This
 * recomputes every standing name from the same summaries the page uses and
 * re-ranks the line, so the two cannot disagree.
 */
export async function rescoreQueue(db: D1): Promise<number> {
  const rows = await db
    .prepare("SELECT id, name, rank, mentions FROM queue_people")
    .all();
  const queue = (rows.results ?? [])
    .map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      rank: Number(row.rank ?? 0),
      mentions: Number(row.mentions ?? 0),
    }))
    .filter((row) => row.id && row.name);
  if (!queue.length) return 0;

  const summaries = await readLedgerSummaries();
  const scored = queue.map((row) => ({
    ...row,
    score: Math.round((ledgerSummaryFor(summaries, row.name)?.evidence ?? 0) * 10) / 10,
  }));
  scored.sort((a, b) => b.score - a.score || b.mentions - a.mentions);

  const statements = scored.map((row, i) =>
    db
      .prepare("UPDATE queue_people SET score = ?, prev_rank = ?, rank = ? WHERE id = ?")
      .bind(row.score, row.rank > 0 ? row.rank : null, i + 1, row.id),
  );
  // One subrequest per batch rather than one per name: the whole queue is
  // rewritten on every discovery and line pass, and D1 charges both.
  for (let i = 0; i < statements.length; i += 50) {
    const chunk = statements.slice(i, i + 50);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
  return scored.length;
}

/**
 * The drop, and the return.
 *
 * When a counter reaches the threshold the blade falls, the chop is written to
 * the record, and the person goes back into the line with their counter reset.
 * Being chopped is not an ending — it is a tally. The archive remembers; the
 * line keeps going.
 *
 * One chop per name per cooling window: without it, every page load would chop
 * the same person again, because the research pass restores their score. The
 * wall counts executions, not refreshes.
 */
/**
 * The blade hangs, then falls on schedule.
 *
 * A name that reaches the threshold is sentenced during the half hour before a
 * public execution slot (09:00, 13:00, 17:00 or 21:00 UTC). Its countdown runs
 * in public; when it reaches zero the blade drops, the head rolls, the counter
 * resets and the next name waits for the next hour. One execution per slot, so
 * the line moves like a ritual and not like a batch job.
 */

export interface Sentence {
  person: string;
  slug: string;
  score: number;
  sentencedAt: string;
  executeAt: string;
  /** The charge in Ada's words, snapshotted when the sentence was written. */
  reason: string;
  /** JSON: score and the acts behind it, with their sources. */
  basis: string;
}

export interface Execution extends Sentence {
  executedAt: string;
}

const sentenceFrom = (r: Record<string, unknown>): Sentence => ({
  reason: String(r.reason ?? ""),
  basis: String(r.basis ?? "{}"),
  person: String(r.person),
  slug: String(r.slug),
  score: Number(r.score),
  sentencedAt: String(r.sentenced_at),
  executeAt: String(r.execute_at),
});

/** The sentence waiting for its blade, or null. */
export async function readSentence(db: D1): Promise<Sentence | null> {
  try {
    const row = await db
      .prepare(
        "SELECT person, slug, score, sentenced_at, execute_at, reason, basis FROM chop_sentences WHERE executed_at IS NULL ORDER BY execute_at ASC LIMIT 1",
      )
      .first<Record<string, unknown>>();
    return row ? sentenceFrom(row) : null;
  } catch {
    return null;
  }
}

/** The last blade that fell, while the wound is still fresh. */
export async function readLastExecution(
  db: D1,
  withinMs = 30 * 60 * 1000,
): Promise<Execution | null> {
  try {
    const row = await db
      .prepare(
        "SELECT person, slug, score, sentenced_at, execute_at, executed_at, reason, basis FROM chop_sentences WHERE executed_at IS NOT NULL ORDER BY executed_at DESC LIMIT 1",
      )
      .first<Record<string, unknown>>();
    if (!row) return null;
    const at = String(row.executed_at);
    if (Date.now() - Date.parse(at) > withinMs) return null;
    return { ...sentenceFrom(row), executedAt: at };
  } catch {
    return null;
  }
}

/**
 * Sentence the worst name that is eligible, if the line is not already waiting
 * on a blade.
 *
 * Two gates, both about proof rather than arithmetic:
 *
 * - the name must be in the sentence band, the worst by evidence in the line.
 *   There is no absolute threshold to cross; a record is not a verdict.
 * - it must have waited out the cooldown since its last chop, so the blade
 *   moves through the worst names instead of returning to the same one.
 *
 * A name with no act inside the evidence window scores zero and can never be
 * sentenced. That is the proof gate: no recent record, no blade.
 */
export async function ensureSentence(
  db: D1,
  readingAt?: string | null,
): Promise<Sentence | null> {
  const pending = await readSentence(db);
  if (pending) return pending;

  const now = Date.now();
  const slot = sentenceSlot(now, readingAt);
  if (slot == null) return null;

  // One name per appointment. The next name in the band waits for the next
  // public hour, which is at most four hours away — long enough for the blade
  // to be an event, short enough that the queue does not become a week.
  //
  // The band is the top of the line, so the page and the block agree: what a
  // reader sees at the top is what the blade can take.
  const cooldownFrom = new Date(
    now - COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const top = await db
    .prepare(
      `SELECT slug, name, score, reason FROM queue_people
       WHERE score > 0
         AND slug NOT IN (
           SELECT slug FROM chop_events WHERE chopped_at > ?
         )
         AND slug IN (
           SELECT slug FROM queue_people
           WHERE score > 0
           ORDER BY score DESC, mentions DESC
           LIMIT ?
         )
       ORDER BY score DESC, mentions DESC LIMIT 1`,
    )
    .bind(cooldownFrom, SENTENCE_BAND)
    .first<Record<string, unknown>>();
  if (!top) return null;

  const sentencedAt = new Date(now).toISOString();
  const slotIso = new Date(slot).toISOString();
  const slug = String(top.slug);

  // The reason is snapshotted here, with the acts behind it. The queue row is
  // rewritten on every pass, so the explanation for an execution would
  // otherwise be the one thing the record does not keep.
  const reason = String(top.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 700);
  const acts = await sentenceEvidence(db, String(top.name));

  // Deterministic per person per slot: two simultaneous page loads cannot put
  // the same name on the block twice.
  await db
    .prepare(
      "INSERT OR IGNORE INTO chop_sentences (id, slug, person, score, sentenced_at, execute_at, reason, basis) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      `${slug}:${slotIso}`,
      slug,
      String(top.name),
      Number(top.score),
      sentencedAt,
      slotIso,
      reason,
      JSON.stringify({ score: Number(top.score), reason, acts }),
    )
    .run();

  return readSentence(db);
}

/**
 * The blade falls on every sentence whose countdown has run out.
 *
 * Claiming the sentence is the lock. The tick and a page load can both see the
 * same due row; only the call whose conditional update changes a row goes on to
 * write the chop and raise the tally, so a blade that falls once is counted
 * once. The event id is the sentence id, so a retry cannot add a second cross.
 */
export async function executeDueSentences(db: D1): Promise<number> {
  const now = new Date().toISOString();
  let rows: { results?: Array<Record<string, unknown>> };
  try {
    rows = await db
      .prepare(
        "SELECT id, slug, person, score, reason, basis FROM chop_sentences WHERE executed_at IS NULL AND execute_at <= ?",
      )
      .bind(now)
      .all();
  } catch {
    return 0;
  }

  const due = rows.results ?? [];
  let executed = 0;
  for (const p of due) {
    const id = String(p.id);
    const slug = String(p.slug);
    const claim = (await db
      .prepare(
        "UPDATE chop_sentences SET executed_at = ? WHERE id = ? AND executed_at IS NULL",
      )
      .bind(now, id)
      .run()) as { meta?: { changes?: number } } | undefined;
    if (Number(claim?.meta?.changes ?? 0) !== 1) continue;

    await db
      .prepare(
        "INSERT OR REPLACE INTO chop_events (id, person, slug, score, chopped_at, reason, basis) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        String(p.person),
        slug,
        Number(p.score),
        now,
        String(p.reason ?? ""),
        String(p.basis ?? "{}"),
      )
      .run();
    // The chop is a tally, not a reset. The record that put the name here has
    // not changed; the cooldown is what keeps the blade moving.
    await db
      .prepare(
        "UPDATE queue_people SET times_chopped = times_chopped + 1, dropped_at = NULL WHERE slug = ?",
      )
      .bind(slug)
      .run();
    executed += 1;
  }
  return executed;
}

export interface ChopBasisAct {
  act: string;
  url: string;
  title: string;
  at: string | null;
  category: string;
}

/** The acts a sentence stands on: the newest verified passages for the name. */
async function sentenceEvidence(db: D1, name: string): Promise<ChopBasisAct[]> {
  try {
    const rows = await db
      .prepare(
        `SELECT c.act, c.category, COALESCE(c.act_date, d.published_at) AS at, d.url, d.title
           FROM claims c
           JOIN entities e ON e.id = c.entity_id
           JOIN documents d ON d.id = c.document_id
          WHERE lower(e.name) = lower(?)
            AND d.kind = 'press' AND c.status != 'retracted'
            AND trim(coalesce(c.quote, '')) != ''
            AND instr(d.text_excerpt, c.quote) > 0
          ORDER BY COALESCE(c.act_date, d.published_at) DESC
          LIMIT 3`,
      )
      .bind(name)
      .all();
    return (rows.results ?? []).map((r) => ({
      act: String(r.act ?? "").slice(0, 400),
      url: String(r.url ?? ""),
      title: String(r.title ?? ""),
      at: r.at == null ? null : String(r.at),
      category: String(r.category ?? ""),
    }));
  } catch {
    return [];
  }
}

export interface ChopEventRow {
  person: string;
  slug: string;
  score: number;
  choppedAt: string;
  reason: string;
  acts: ChopBasisAct[];
}

/**
 * Every time the blade fell on this name, with the charge it fell on.
 *
 * The event keeps its own snapshot, so a later pass rewriting the queue cannot
 * rewrite history. This is the record of why, not the current opinion of why.
 */
export async function chopHistoryFor(
  db: D1,
  slug: string,
  limit = 10,
): Promise<ChopEventRow[]> {
  try {
    const rows = await db
      .prepare(
        "SELECT person, slug, score, chopped_at, reason, basis FROM chop_events WHERE slug = ? ORDER BY chopped_at DESC LIMIT ?",
      )
      .bind(slug, limit)
      .all();
    return (rows.results ?? []).map((r) => {
      let acts: ChopBasisAct[] = [];
      try {
        const parsed = JSON.parse(String(r.basis ?? "{}")) as { acts?: ChopBasisAct[] };
        acts = Array.isArray(parsed.acts) ? parsed.acts.slice(0, 3) : [];
      } catch {
        acts = [];
      }
      return {
        person: String(r.person ?? ""),
        slug: String(r.slug ?? ""),
        score: Number(r.score ?? 0),
        choppedAt: String(r.chopped_at ?? ""),
        reason: String(r.reason ?? ""),
        acts,
      };
    });
  } catch {
    return [];
  }
}

export interface ChopRow {
  person: string;
  slug: string;
  count: number;
  lastAt: string;
}

export async function listChops(db: D1): Promise<ChopRow[]> {
  const rows = await db
    .prepare(
      "SELECT person, slug, COUNT(*) AS n, MAX(chopped_at) AS last FROM chop_events GROUP BY slug ORDER BY n DESC, last DESC",
    )
    .all();
  return (rows.results ?? []).map((r) => ({
    person: String(r.person),
    slug: String(r.slug),
    count: Number(r.n),
    lastAt: String(r.last),
  }));
}
