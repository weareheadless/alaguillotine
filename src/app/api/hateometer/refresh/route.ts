import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { runHatePass } from "@/lib/hate-research";
import { getDb, readHate, readQueue, writeHate, writeQueue } from "@/lib/hate-store";
import { ledgerSummaryFor, readLedgerSummaries } from "@/lib/archive-store";
import { registerQueueNames } from "@/lib/coverage";
import { writeLedgerEntries } from "@/lib/ledger-write";
import { slugify } from "@/lib/slug";
import { publishClaimsToFeed } from "@/lib/claim-feed";
import type { Figure } from "@/lib/hateometer";

export const dynamic = "force-dynamic";

/**
 * POST /api/hateometer/refresh — the queue's research pass.
 *
 * Cron-only. Ada updates everyone already standing in the queue and adds new
 * names when the reporting names them.
 *
 * The number written here is not the model's reading. It is the harm the
 * ledger documents inside the evidence window, weighted by confidence and
 * category. A name the wire forgot keeps the number its record earns; a name
 * the wire loves cannot outrun a thin record. Nobody is dropped for a quiet
 * week, and nobody is carried by arithmetic.
 */
export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      DEEPSEEK_API_KEY?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_SEARCH_BASE?: string;
      CLOCK_CHAT_BASE?: string;
      CLOCK_MODEL?: string;
    };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = clockConfig(context.env ?? {});
  if (!config) return Response.json({ error: "no model key configured" }, { status: 500 });

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  try {
    const previous = await readHate(db);
    const queue = await readQueue(db);
    const ledger = await readLedgerSummaries();
    const pass = await runHatePass(config, previous?.level ?? null, queue, ledger);

    // The number is the record inside the window — not the pass's reading,
    // not a bonus, and not a floor for lifetime volume.
    const evidenceScore = (name: string): number =>
      ledgerSummaryFor(ledger, name)?.evidence ?? 0;

    // Merge today's findings into the standing queue. The pass still decides
    // who is nominated and what the charge reads; it no longer decides the
    // order. That is the ledger's job.
    const seen = new Map(pass.figures.map((f) => [f.name.toLowerCase(), f]));
    // A name with no record and no story is not being kept for later; it was
    // nominated on a bad afternoon and never documented. A quiet week does not
    // drop anybody — but a name that has never had a charge has nothing to
    // stand on, and leaving it in the line at zero reads as an accusation with
    // no receipt behind it.
    const merged: Figure[] = queue.flatMap((person): Figure[] => {
      const fresh = seen.get(person.name.toLowerCase());
      const score = evidenceScore(person.name);
      const charges = ledgerSummaryFor(ledger, person.name)?.count ?? 0;
      if (fresh) return [{ ...person, ...fresh, score, addedAt: person.addedAt }];
      if (!charges) return [];
      return [{ ...person, mentions: 0, delta: null, score }];
    });

    const known = new Set(queue.map((p) => p.name.toLowerCase()));
    const arrivals = pass.figures.filter((f) => !known.has(f.name.toLowerCase()));

    // A name cannot enter the line with no charge: a ranked list of people
    // with nothing on record is the site accusing whoever the wire was loudest
    // about that afternoon. So the pass's own charge is filed as a receipt — the
    // act, the date and the story it came from — before the name is scored.
    // That is what makes a fresh atrocity land today instead of waiting for the
    // next dossier rotation.
    const categoryOf = (dimension?: string): string => {
      switch (String(dimension ?? "")) {
        case "repression":
          return "repression";
        case "arms":
          return "arms";
        case "incitement":
          return "media";
        default:
          return "war";
      }
    };
    const boilerplate = (reason: string): boolean =>
      reason.length < 25 ||
      /no documented (act|charge)|nothing documented|appears? to have no|no charges? (appear|on record)/i.test(
        reason,
      );

    let filed = 0;
    const skipped: Array<{ name: string; why: string }> = [];
    for (const fresh of arrivals.slice(0, 20)) {
      if (boilerplate(fresh.reason)) {
        skipped.push({ name: fresh.name, why: "no charge in the reason" });
        continue;
      }
      const cited = fresh.items ?? [];
      const sources = [...new Set(cited.map((i) => i.sourceUrl).filter((u) => /^https?:\/\//.test(u)))];
      if (!sources.length) {
        skipped.push({ name: fresh.name, why: "no cited story" });
        continue;
      }
      const dated = cited.find((i) => i.publishedAt);
      // The act's year, not the article's: a 2026 story about a 2019 fraud is
      // a 2019 charge, and the window has to see it that way.
      const year =
        Number(fresh.actYear) ||
        (dated ? Number(String(dated.publishedAt).slice(0, 4)) : new Date().getUTCFullYear());
      try {
        const wrote = await writeLedgerEntries(db, fresh.name, [
          {
            person: fresh.name,
            role: fresh.role,
            act: fresh.reason,
            place: fresh.country,
            year: Number.isFinite(year) ? year : new Date().getUTCFullYear(),
            category: categoryOf(cited[0]?.dimension),
            confidence: sources.length >= 2 ? 60 : 45,
            sources: sources.slice(0, 3),
            caseId: `queue:${fresh.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            attribution: 1,
          },
        ]);
        filed += wrote.added;
      } catch (error) {
        console.error(
          "queue_receipt_failed",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }

    // Everyone already standing gets their new act filed too. Before this the
    // pass only wrote a claim when a name *arrived*, so a person on the list
    // could be in the wire for a week and their page would not move. One claim
    // per name per pass, deduplicated by the act itself, capped so a busy wire
    // cannot bury the review desk.
    let refreshed = 0;
    const arrivalNames = new Set(arrivals.map((a) => a.name.toLowerCase()));
    const onTheList = new Set(queue.map((q) => q.name.toLowerCase()));
    for (const fresh of pass.figures) {
      if (refreshed >= 12) break;
      const key = fresh.name.toLowerCase();
      if (arrivalNames.has(key) || !onTheList.has(key)) continue;
      if (boilerplate(fresh.reason)) continue;
      const cited = fresh.items ?? [];
      const sources = [
        ...new Set(cited.map((i) => i.sourceUrl).filter((u) => /^https?:\/\//.test(u))),
      ];
      if (!sources.length) continue;
      const dated = cited.find((i) => i.publishedAt);
      const year =
        Number(fresh.actYear) ||
        (dated ? Number(String(dated.publishedAt).slice(0, 4)) : new Date().getUTCFullYear());
      try {
        const wrote = await writeLedgerEntries(db, fresh.name, [
          {
            person: fresh.name,
            role: fresh.role,
            act: fresh.reason,
            place: fresh.country,
            year: Number.isFinite(year) ? year : new Date().getUTCFullYear(),
            category: categoryOf(cited[0]?.dimension),
            confidence: sources.length >= 2 ? 60 : 45,
            sources: sources.slice(0, 3),
            caseId: `queue:${fresh.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            attribution: 1,
          },
        ]);
        refreshed += wrote.added;
      } catch (error) {
        console.error(
          "stander_receipt_failed",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    filed += refreshed;

    // Re-read the record if anything was just filed, so the arrival is scored
    // on the charge that put it here rather than on an empty ledger.
    const record = filed > 0 ? await readLedgerSummaries() : ledger;
    const scoreOf = (name: string): number =>
      ledgerSummaryFor(record, name)?.evidence ?? 0;

    // No receipt, no place in the line. A nomination whose charge could not be
    // filed — no cited story, an undated act, a historical retrospective — is
    // the same hole as the zeros: a rank with nothing behind it.
    const admitted: string[] = [];
    for (const fresh of arrivals) {
      const score = scoreOf(fresh.name);
      if (score <= 0) continue;
      admitted.push(fresh.name);
      merged.push({
        ...fresh,
        score,
        addedAt: pass.computedAt,
      });
    }

    // Sorted by the evidence, then by how many acts are behind it. No ceiling
    // clamp: the number is the number, and a tie should read as a tie.
    merged.sort(
      (a, b) => b.score - a.score || (b.mentions ?? 0) - (a.mentions ?? 0),
    );

    const ranked = merged.map((person, i) => {
      const rank = i + 1;
      const was = queue.find((q) => q.name.toLowerCase() === person.name.toLowerCase());
      return {
        ...person,
        rank,
        prevRank: was?.rank ?? null,
        delta: was ? was.rank - rank : null,
      };
    });

    await writeQueue(db, ranked);

    // writeQueue only upserts, so a name taken out of the line above would stay
    // in the table and keep appearing on the page. Prune what the pass no
    // longer keeps: their ledger and their page are untouched — it is the queue
    // row, not the record, that goes.
    const keep = new Set(ranked.map((p) => slugify(p.name)));
    const standing = await db.prepare("SELECT slug FROM queue_people").bind().all();
    for (const r of standing.results ?? []) {
      const slug = String(r.slug ?? "");
      if (slug && !keep.has(slug)) {
        await db.prepare("DELETE FROM queue_people WHERE slug = ?").bind(slug).run();
      }
    }
    // A new name is registered for its first look the moment it enters the
    // line, not whenever the next coverage cron happens to run.
    await registerQueueNames(db);
    await writeHate(db, {
      level: pass.level,
      composite: pass.composite,
      dimensions: pass.dimensions,
      figures: ranked,
      sourceHash: pass.sourceHash,
      computedAt: pass.computedAt,
    });

    // The record reached the front page: accepted claims as charges, and
    // pending A/B filings tagged as such. Idempotent, so running twice adds
    // nothing.
    let published = 0;
    try {
      published = (await publishClaimsToFeed(db, { days: 3, limit: 40 })).published;
    } catch (error) {
      console.error("claim_feed_failed", error instanceof Error ? error.message : "unknown");
    }

    return Response.json({
      ok: true,
      level: pass.level,
      added: ranked.length - queue.length,
      filed,
      published,
      named: pass.figures.length,
      stats: pass.stats ?? null,
      arrivals: admitted.slice(0, 12),
      skipped: skipped.slice(0, 12),
      total: ranked.length,
    });
  } catch (error) {
    console.error("hate_refresh_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "refresh failed" }, { status: 502 });
  }
}
