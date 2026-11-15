import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/reground?limit=40 — put a passage under the old sentences.
 *
 * The legacy import kept 6,082 claims and their 1,895 source URLs, and almost
 * none of them kept the passage the claim came from. Nothing can be re-checked
 * without it, so this fetches the most-cited documents once, stores the text,
 * and looks for the sentence the claim was made from.
 *
 * This is a machine match, not a review. A claim that matches is marked
 * `matched` — the passage was located, nobody has read it against the claim
 * yet — and its confidence is capped below anything accepted. A claim that does
 * not match stays `legacy` and visibly uncited, which is the truthful outcome
 * for most of a record built from paraphrase.
 */

const UA = "AdaGuillotine/1.0 (register verification)";

const STOP = new Set(
  ("the and for with that this from have has are was were will would into over " +
    "after before about their they them than then says said new now you your his " +
    "her its our out not but who what when where why how all can could may been " +
    "more most also just like such only very than there these those which while " +
    "under between during against through during")
    .split(/\s+/),
);

function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w)),
  );
}

/** The surname is the cheapest reliable handle on a person in a sentence. */
function surname(name: string): string {
  const parts = name.replace(/\(.*?\)/g, " ").trim().split(/\s+/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

interface Match {
  quote: string;
  locator: string;
  score: number;
}

function findPassage(text: string, act: string, person: string): Match | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 60 && s.length <= 500);
  if (!sentences.length) return null;
  const want = words(act);
  if (want.size < 3) return null;
  const key = surname(person);
  // A figure in the claim has to appear in the passage: "4,900 protesters" and
  // "725.8" are the parts a paraphrase cannot fake.
  const figures = (act.match(/\d[\d.,]{2,}/g) ?? []).map((n) => n.replace(/[.,]$/, ""));
  let best: Match | null = null;

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const lower = sentence.toLowerCase();
    if (key.length > 2 && !lower.includes(key)) continue;
    if (figures.length && !figures.some((n) => lower.includes(n.toLowerCase()))) continue;
    const have = words(sentence);
    let shared = 0;
    for (const word of want) if (have.has(word)) shared += 1;
    // Four in ten content words, not three: the loose threshold matched page
    // furniture that mentioned the name and nothing else.
    const score = shared / want.size;
    if (score < 0.4 || shared < 3) continue;
    if (!best || score > best.score) {
      best = {
        quote: sentence.slice(0, 400),
        locator: `sentence ${i + 1}`,
        score: Math.round(score * 100) / 100,
      };
    }
  }
  return best;
}

/**
 * Look for each legacy claim's sentence in a document's stored text.
 *
 * Shared by the fetch pass and the stored pass so a second run cannot use a
 * different matching rule than the first. A match marks the claim `matched`,
 * not `recorded`: the sentence was located, nobody has read it against the
 * claim, and it still cannot accuse anyone.
 */
async function groundDocument(
  db: D1,
  documentId: string,
  text: string,
  now: string,
): Promise<{ claimsSeen: number; matched: number }> {
  const claims = await db
    .prepare(
      `SELECT c.id, c.act, e.name
         FROM claim_documents cd
         JOIN claims c ON c.id = cd.claim_id
         JOIN entities e ON e.id = c.entity_id
        WHERE cd.document_id = ? AND c.status = 'legacy' AND c.legacy_id IS NOT NULL`,
    )
    .bind(documentId)
    .all();

  let claimsSeen = 0;
  let matched = 0;
  for (const claim of claims.results ?? []) {
    claimsSeen += 1;
    const hit = findPassage(text, String(claim.act ?? ""), String(claim.name ?? ""));
    if (!hit) continue;
    matched += 1;
    await db
      .prepare(
        `UPDATE claims
            SET status = 'matched', confidence = 0.5,
                confidence_basis = 'passage located mechanically; not yet reviewed',
                updated_at = ?
          WHERE id = ? AND status = 'legacy'`,
      )
      .bind(now, String(claim.id))
      .run();
    await db
      .prepare(
        "UPDATE claim_documents SET quote = ?, locator = ? WHERE claim_id = ? AND document_id = ?",
      )
      .bind(hit.quote, hit.locator, String(claim.id), documentId)
      .run();
  }
  return { claimsSeen, matched };
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
  const limit = Math.max(1, Math.min(40, Number(params.get("limit") ?? 20) || 20));
  const started = new Date().toISOString();

  // A stored pass re-uses text already fetched. The first pass could only
  // ground claims from documents it fetched itself; a document fetched later
  // still has claims waiting under it, and re-fetching to reach them would be
  // both slow and rude to the publisher.
  if (params.get("mode") === "stored") {
    const pool = await db
      .prepare(
        `SELECT d.id, d.text_excerpt, COUNT(cd.claim_id) AS uses
           FROM documents d
           JOIN claim_documents cd ON cd.document_id = d.id
           JOIN claims c ON c.id = cd.claim_id AND c.status = 'legacy'
          WHERE d.kind = 'press' AND length(d.text_excerpt) > 40
            AND d.reground_at = ''
          GROUP BY d.id
          ORDER BY uses DESC, d.id
          LIMIT ?`,
      )
      .bind(limit)
      .all();

    let seen = 0;
    let hit = 0;
    for (const row of pool.results ?? []) {
      const result = await groundDocument(db, String(row.id ?? ""), String(row.text_excerpt ?? ""), started);
      await db
        .prepare("UPDATE documents SET reground_at = ? WHERE id = ?")
        .bind(started, String(row.id ?? ""))
        .run();
      seen += result.claimsSeen;
      hit += result.matched;
    }

    try {
      await db
        .prepare(
          "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('reground-stored', ?, ?, ?, ?)",
        )
        .bind(started, new Date().toISOString(), hit, null)
        .run();
    } catch {
      /* logging never blocks the pass */
    }

    return Response.json(
      { ok: true, mode: "stored", documents: (pool.results ?? []).length, claimsSeen: seen, matched: hit },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Most-cited first: one fetch of a heavily used source can ground many claims.
  const rows = await db
    .prepare(
      `SELECT d.id, d.url, d.kind, COUNT(cd.claim_id) AS uses
         FROM documents d
         LEFT JOIN claim_documents cd ON cd.document_id = d.id
        WHERE d.fetched_at = ''
        GROUP BY d.id
        ORDER BY uses DESC, d.id
        LIMIT ?`,
    )
    .bind(limit)
    .all();

  const docs = (rows.results ?? []).map((r) => ({
    id: String(r.id ?? ""),
    url: String(r.url ?? ""),
    kind: String(r.kind ?? "press"),
  }));

  let fetched = 0;
  let failed = 0;
  let matched = 0;
  let claimsSeen = 0;

  const one = async (doc: { id: string; url: string; kind: string }) => {
    const now = new Date().toISOString();
    let text = "";
    let status = 0;
    try {
      const res = await fetch(doc.url, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      status = res.status;
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && /html|text|xml/i.test(type)) {
        text = textOf((await res.text()).slice(0, 900_000)).slice(0, 60_000);
      }
    } catch {
      status = 0;
    }

    if (!text) {
      await db
        .prepare("UPDATE documents SET fetched_at = ?, http_status = ? WHERE id = ?")
        .bind(now, status, doc.id)
        .run();
      failed += 1;
      return;
    }

    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
    const hash = [...new Uint8Array(digest)]
      .slice(0, 12)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await db
      .prepare(
        "UPDATE documents SET text_excerpt = ?, content_hash = ?, fetched_at = ?, http_status = ? WHERE id = ?",
      )
      .bind(text, hash, now, status, doc.id)
      .run();
    fetched += 1;

    // Sentence matching is for prose. A roll call or a docket is a structured
    // record: its member-by-member vote is a field, not a sentence, and
    // pretending otherwise produced quotes that were really the page header.
    // Those documents wait for their connector.
    if (doc.kind !== "press") return;

    const grounded = await groundDocument(db, doc.id, text, now);
    claimsSeen += grounded.claimsSeen;
    matched += grounded.matched;
  };

  // Four at a time: enough to finish inside a request, gentle on the sources.
  for (let i = 0; i < docs.length; i += 4) {
    await Promise.all(docs.slice(i, i + 4).map(one));
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('reground', ?, ?, ?, ?)",
      )
      .bind(started, new Date().toISOString(), fetched, failed ? `${failed} unfetchable` : null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json(
    { ok: true, documents: docs.length, fetched, failed, claimsSeen, matched },
    { headers: { "Cache-Control": "no-store" } },
  );
}
