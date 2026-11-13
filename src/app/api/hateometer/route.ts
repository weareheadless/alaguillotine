import { chargeStats, ledgerSummaryFor, readLedgerSummaries } from "@/lib/archive-store";
import { slugify } from "@/lib/slug";
import { emptyHate, itemMentions, type HateState } from "@/lib/hateometer";
import { coverageBySlug } from "@/lib/coverage";
import { readAllNumbers } from "@/lib/numbers";
import {
  ensureSentence,
  executeDueSentences,
  getDb,
  listChops,
  readHate,
  readLastExecution,
  readQueue,
} from "@/lib/hate-store";

export const revalidate = 0;
export const dynamic = "force-dynamic";

/** GET /api/hateometer — the queue and its counters. */
export async function GET() {
  try {
    const db = await getDb();
    if (!db) return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });

    // A name can only be sentenced in the half hour before a public slot, and
    // only once the reading for that slot has landed. The first call creates
    // the sentence, the second picks up whatever is left after any execution.
    const row = await readHate(db);
    await ensureSentence(db, row?.computedAt ?? null);
    await executeDueSentences(db);
    const execution = await ensureSentence(db, row?.computedAt ?? null);
    const lastExecution = execution ? null : await readLastExecution(db);
    const queue = await readQueue(db);
    if (!row && queue.length === 0) {
      return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });
    }

    const chops = await listChops(db);
    const chopBySlug = Object.fromEntries(chops.map((c) => [c.slug, c]));
    const [summaries, ledgerStats] = await Promise.all([
      readLedgerSummaries(),
      chargeStats(),
    ]);
    const coverage = await coverageBySlug(db);
    const allNumbers = await readAllNumbers(db);

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

    const state: HateState = {
      level: row?.level ?? 0,
      composite: row?.composite ?? 0,
      pressure: row ? Math.round((row.composite - row.level) * 100) / 100 : 0,
      dimensions: row?.dimensions ?? emptyHate().dimensions,
      figures: withCounts,
      chops,
      computedAt: row?.computedAt ?? null,
      ledgerTotal: ledgerStats.total,
      ledgerToday: ledgerStats.last24h,
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

    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("hate_read_failed", error instanceof Error ? error.message : "unknown");
    return Response.json(emptyHate(), { headers: { "Cache-Control": "no-store" } });
  }
}
