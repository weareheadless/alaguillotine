import type { D1 } from "@/lib/clock-store";
import { chargeStats, ledgerSummaryFor, readLedgerSummaries } from "@/lib/archive-store";
import { slugify } from "@/lib/slug";
import { emptyHate, itemMentions, type HateState } from "@/lib/hateometer";
import { coverageBySlug } from "@/lib/coverage";
import { feedCounts } from "@/lib/feed";
import { readAllNumbers } from "@/lib/numbers";
import {
  ensureSentence,
  executeDueSentences,
  listChops,
  readHate,
  readLastExecution,
  readQueue,
} from "@/lib/hate-store";

/**
 * The reading, built once for whoever asks.
 *
 * The front page and the API endpoint used to build this in two different
 * places with the same query behind it. The page now renders it on the server,
 * so the first HTML a reader gets is the record itself — the names, the counts,
 * the appointment — instead of an empty shell that fills in after JavaScript
 * and a 300 KB fetch.
 */

/**
 * A reading is expensive and identical for every reader. The aggregates below
 * are held for a minute in the isolate: the queue is always read fresh, but the
 * ledger counts, the coverage map and the number list do not change between two
 * page loads.
 */
const MEMO = new Map<string, { at: number; value: unknown }>();

async function memo<T>(key: string, ttlMs: number, run: () => Promise<T>): Promise<T> {
  const hit = MEMO.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await run();
  MEMO.set(key, { at: Date.now(), value });
  return value;
}

export async function buildHateState(db: D1): Promise<HateState> {
  // A name can only be sentenced in the half hour before a public slot, and
  // only once the reading for that slot has landed. The first call creates
  // the sentence, the second picks up whatever is left after any execution.
  const row = await readHate(db);
  await ensureSentence(db, row?.computedAt ?? null);
  await executeDueSentences(db);

  // Everything that only reads is read together. This used to be five round
  // trips in a row, which is most of a second before the page can be sent.
  const [execution, queue, chops, last] = await Promise.all([
    ensureSentence(db, row?.computedAt ?? null),
    readQueue(db),
    listChops(db),
    readLastExecution(db),
  ]);
  const lastExecution = execution ? null : last;
  if (!row && queue.length === 0) return emptyHate();

  const chopBySlug = Object.fromEntries(chops.map((c) => [c.slug, c]));
  const [summaries, ledgerStats, wire, coverage, allNumbers] = await Promise.all([
    memo("ledger-summaries", 60_000, () => readLedgerSummaries()),
    memo("charge-stats", 60_000, () => chargeStats()),
    memo("feed-count", 30_000, () => feedCount(db)),
    memo("coverage", 120_000, () => coverageBySlug(db)),
    memo("numbers", 300_000, () => readAllNumbers(db)),
  ]);

  const withCounts = (queue.length ? queue : (row?.figures ?? [])).map((f) => {
    const slug = slugify(f.name);
    const chop = chopBySlug[slug];
    const summary = ledgerSummaryFor(summaries, f.name);
    // A stored pass may have attached an unrelated story (the model is told
    // every figure needs one). Show only items that actually name them, and
    // fall back to the ledger charges when the record is the only evidence.
    const items = (f.items ?? []).filter((item) => itemMentions(f.name, item));
    const read = coverage.get(slug);
    return {
      ...f,
      items,
      mentions: items.length,
      investigated: read?.status === "done",
      investigation: read
        ? { status: read.status, checkedAt: read.checkedAt, entries: read.entries }
        : { status: "pending" as const, checkedAt: null, entries: 0 },
      source: items[0]?.source ?? "ada's record",
      sourceUrl:
        items[0]?.sourceUrl ??
        `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(f.name)}`,
      // The exact number of entries behind this name, not a token sum:
      // overlapping names were inflating the total by hundreds.
      ledgerCount: summary?.count ?? 0,
      // The number is the window, so the card shows what is inside it.
      windowActs: summary?.windowActs ?? 0,
      latestAct: summary?.newest ?? null,
      topCharges: summary?.top ?? [],
      timesChopped: chop?.count ?? f.timesChopped ?? 0,
      lastChoppedAt: chop?.lastAt ?? f.lastChoppedAt ?? null,
      numbers: allNumbers[slug] ?? [],
    };
  });

  return {
    level: row?.level ?? 0,
    composite: row?.composite ?? 0,
    pressure: row ? Math.round((row.composite - row.level) * 100) / 100 : 0,
    dimensions: row?.dimensions ?? emptyHate().dimensions,
    figures: withCounts,
    chops,
    computedAt: row?.computedAt ?? null,
    ledgerTotal: ledgerStats.total,
    ledgerToday: ledgerStats.last24h,
    wire,
    nextRunAt: row
      ? new Date(Date.parse(row.computedAt) + 12 * 60 * 60 * 1000).toISOString()
      : null,
    stale: row ? Date.now() - Date.parse(row.computedAt) > 36 * 60 * 60 * 1000 : true,
    execution: execution
      ? {
          ...execution,
          secondsLeft: Math.max(
            0,
            Math.round((Date.parse(execution.executeAt) - Date.now()) / 1000),
          ),
        }
      : null,
    lastExecution,
  };
}

/**
 * What the feed is holding right now.
 *
 * The same predicate the feed page queries with, so the number in the hero line
 * is the number of cards a reader would actually find: everything, subject to
 * the wire's one-day rule. A count that no page can reproduce is a decoration.
 */
async function feedCount(db: D1) {
  try {
    // Today's cards and the kept month, because that is what the feed page
    // will actually scroll through. The freshness claim lives in the age shown
    // next to it, not in hiding the archive.
    const counts = await feedCounts(db as Parameters<typeof feedCounts>[0]);
    const row = await db
      .prepare("SELECT MAX(published_at) AS newest FROM feed_items WHERE cluster = id")
      .first<{ newest?: string | null }>();
    return {
      count: counts.fresh + counts.archive,
      newestAt: row?.newest ? String(row.newest) : null,
    };
  } catch {
    return { count: 0, newestAt: null as string | null };
  }
}
