import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { recomputeUniverseStatus } from "@/lib/register/coverage-status";
import {
  findPeople,
  isActShaped,
  isAllegation,
  needlesFor,
  parseFeed,
  pressText,
  PRESS_FEEDS,
  sentenceFor,
  type GazetteerEntry,
} from "@/lib/register/press";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/press?limit=60&fetch=8 — read the published feeds.
 *
 * No model call and no crawl: six RSS feeds, an item only if its text names a
 * tracked person, one sentence as the passage, and the outlet as the issuer.
 * The claim is `reported` unless the sentence carries an allegation, in which
 * case it is `alleged` and `finding` is set. Neither is a `found`: a finding
 * needs a court, regulator or admission, and this connector cannot create one.
 *
 * A second outlet naming the same act and date attaches to the same claim; a
 * paraphrase is its own row. Repetition is not evidence, and the dashboard
 * shows each outlet as its own source.
 */

const UA = "AdaGuillotine/1.0 (register press)";
const BATCH = 50;

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
}

async function sha16(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as { env?: Env };
  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const params = new URL(request.url).searchParams;
  const limit = Math.max(1, Math.min(180, Number(params.get("limit") ?? 120) || 120));
  const perFeed = Math.max(5, Math.ceil(limit / PRESS_FEEDS.length));
  const fetchCap = Math.max(0, Math.min(20, Number(params.get("fetch") ?? 8) || 0));
  const only = (params.get("feed") ?? "").trim();
  const now = new Date().toISOString();

  const rows = await db
    .prepare("SELECT id, name, aliases FROM entities WHERE kind = 'person'")
    .all();
  const gazetteer: GazetteerEntry[] = (rows.results ?? [])
    .map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      needles: needlesFor(String(row.name ?? ""), String(row.aliases ?? "[]")),
    }))
    .filter((entry) => entry.id && entry.needles.length);

  const tally = {
    feeds: 0,
    items: 0,
    named: 0,
    fetched: 0,
    documents: 0,
    claims: 0,
    alleged: 0,
    errors: [] as string[],
  };

  let fetchedArticles = 0;
  let considered = 0;

  for (const feed of PRESS_FEEDS) {
    if (only && only !== feed.key) continue;
    tally.feeds += 1;

    let xml = "";
    try {
      const response = await fetch(feed.url, {
        headers: { "user-agent": UA, accept: "application/rss+xml,application/xml,text/xml" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`${feed.key} ${response.status}`);
      xml = await response.text();
    } catch (error) {
      tally.errors.push(String(error).slice(0, 120));
      continue;
    }

    const items = parseFeed(xml).slice(0, Math.min(40, perFeed));
    tally.items += items.length;

    for (const item of items) {
      if (considered >= limit) break;
      considered += 1;

      // Keep a headline off the front of the first sentence; the body is the
      // document, the title is only a fallback when the feed gives nothing else.
      const body = pressText(item.body);
      let text = body.length >= 80 ? body : pressText(`${item.title}. ${item.body}`);
      let hits = findPeople(text, gazetteer);
      if (!hits.length) continue;

      // A summary is often a headline and a teaser. If it already names
      // someone, one bounded fetch gives the sentence room to exist.
      if (text.length < 600 && fetchedArticles < fetchCap) {
        try {
          const response = await fetch(item.link, {
            headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
            redirect: "follow",
            signal: AbortSignal.timeout(12_000),
          });
          if (response.ok) {
            const full = pressText((await response.text()).slice(0, 900_000)).slice(0, 60_000);
            if (full.length > text.length) {
              text = full;
              hits = findPeople(text, gazetteer);
              fetchedArticles += 1;
              tally.fetched += 1;
            }
          }
        } catch {
          /* the feed text is still a document */
        }
      }

      if (!hits.length) continue;
      tally.named += 1;

      const existingDoc = await db
        .prepare("SELECT id FROM documents WHERE url = ?")
        .bind(item.link)
        .all();
      if ((existingDoc.results ?? []).length) continue;

      const docId = `doc:press:${await sha16(item.link)}`;
      const date = item.published || now.slice(0, 10);
      const hash = await sha16(text);

      const claims: Array<{
        entityId: string;
        sentence: string;
        alleged: boolean;
      }> = [];
      const seenPeople = new Set<string>();
      for (const hit of hits) {
        if (seenPeople.has(hit.entry.id)) continue;
        const sentence = sentenceFor(text, hit.needle);
        if (!sentence || !isActShaped(sentence, hit.needle)) continue;
        seenPeople.add(hit.entry.id);
        claims.push({
          entityId: hit.entry.id,
          sentence,
          alleged: isAllegation(sentence),
        });
      }
      if (!claims.length) continue;

      const writes: ReturnType<D1["prepare"]>[] = [
        db
          .prepare(
            `INSERT OR IGNORE INTO documents
               (id, kind, issuer, title, number, url, published_at, retrieved_at,
                content_hash, locator, provenance, self_serving, text_excerpt,
                fetched_at, http_status, parsed_at)
             VALUES (?, 'press', ?, ?, '', ?, ?, ?, ?, '', ?, 0, ?, ?, 200, ?)`,
          )
          .bind(
            docId,
            feed.issuer,
            item.title.slice(0, 300),
            item.link,
            date,
            now,
            hash,
            `${feed.issuer} RSS feed`,
            text,
            now,
            now,
          ),
      ];

      for (const claim of claims) {
        const act = claim.sentence.slice(0, 400);
        const claimKey = `${claim.entityId}|${act.toLowerCase().replace(/\s+/g, " ").trim()}|${date}`;
        const claimId = `claim:press:${await sha16(claimKey)}`;
        const status = claim.alleged ? "alleged" : "reported";
        const finding = claim.alleged ? "alleged" : "none";
        const confidence = claim.alleged ? 0.4 : 0.45;
        const basis = `${feed.issuer}, sentence located in the feed item; not independently verified`;

        const existing = await db
          .prepare("SELECT id, finding FROM claims WHERE claim_key = ? LIMIT 1")
          .bind(claimKey)
          .all();
        const prior = (existing.results ?? [])[0];
        if (prior?.id) {
          if (prior.finding === "none" && claim.alleged) {
            writes.push(
              db
                .prepare("UPDATE claims SET finding = 'alleged', status = 'alleged', updated_at = ? WHERE id = ?")
                .bind(now, String(prior.id)),
            );
          }
          writes.push(
            db
              .prepare(
                `INSERT OR REPLACE INTO claim_documents (claim_id, document_id, quote, locator, stance)
                 VALUES (?, ?, ?, 'named in the article', 'reports')`,
              )
              .bind(String(prior.id), docId, act),
          );
        } else {
          writes.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO claims
                   (id, entity_id, act, category, mechanism, beneficiary, act_date,
                    date_precision, amount, currency, confidence, confidence_basis,
                    status, finding, claim_key, created_at, updated_at)
                 VALUES (?, ?, ?, 'press', ?, '', ?, 'day', NULL, '', ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                claimId,
                claim.entityId,
                act,
                feed.issuer,
                date,
                confidence,
                basis,
                status,
                finding,
                claimKey,
                now,
                now,
              ),
            db
              .prepare(
                `INSERT OR REPLACE INTO claim_documents (claim_id, document_id, quote, locator, stance)
                 VALUES (?, ?, ?, 'named in the article', 'reports')`,
              )
              .bind(claimId, docId, act),
            db
              .prepare(
                "INSERT OR REPLACE INTO claim_entities (claim_id, entity_id, role) VALUES (?, ?, 'actor')",
              )
              .bind(claimId, claim.entityId),
          );
          tally.claims += 1;
        }
        if (claim.alleged) tally.alleged += 1;
      }

      await batchWrite(db, writes);
      tally.documents += 1;
    }

    if (considered >= limit) break;
  }

  for (const universe of ["house-119", "ep-10", "uk-commons-59"]) {
    await recomputeUniverseStatus(db, universe);
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('press', ?, ?, ?, ?)",
      )
      .bind(now, new Date().toISOString(), tally.claims, tally.errors[0] ?? null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json(
    { ok: true, gazetteer: gazetteer.length, ...tally },
    { headers: { "Cache-Control": "no-store" } },
  );
}
