import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { slugify } from "@/lib/slug";
import {
  articleText,
  extractFindings,
  OUTLETS,
  searchUrl,
  type Finding,
  type Post,
} from "@/lib/findings";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/findings/ingest?outlet=propublica&query=convicted&per=20
 *
 * One investigative archive search. The article is the document; the sentence
 * that states the finding is the claim; the person is created from the article.
 * Nothing has to be in a roster, and no official register is consulted.
 *
 * The query is a finding word ("convicted", "bribery", ...), not a name. That is
 * the whole inversion: the wrongdoing finds the person, not the other way round.
 */

const UA = "AdaGuillotine/1.0 (findings)";
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

function yearOf(quote: string): string | null {
  const years = [...quote.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((match) => Number(match[1]));
  if (!years.length) return null;
  return String(Math.max(...years));
}

function confidenceOf(finding: Finding): number {
  if (finding.finding === "found") return 0.7;
  if (finding.finding === "admitted") return 0.65;
  return 0.45;
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
  const outletKey = (params.get("outlet") ?? "propublica").trim();
  const query = (params.get("query") ?? "convicted").trim();
  const per = Math.max(1, Math.min(50, Number(params.get("per") ?? 20) || 20));
  const after = (params.get("after") ?? "2020-01-01T00:00:00").trim();
  const outlet = OUTLETS.find((entry) => entry.key === outletKey);
  if (!outlet) {
    return Response.json(
      { error: `unknown outlet ${outletKey}`, outlets: OUTLETS.map((o) => o.key) },
      { status: 400 },
    );
  }

  let posts: Post[] = [];
  try {
    const response = await fetch(searchUrl(outlet, query, per, after), {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`${outlet.key} ${response.status}`);
    const body = (await response.json()) as Array<{
      date?: string;
      link?: string;
      title?: { rendered?: string };
      content?: { rendered?: string };
    }>;
    posts = body
      .map((post) => ({
        date: String(post.date ?? "").slice(0, 10),
        link: String(post.link ?? ""),
        title: articleText(String(post.title?.rendered ?? "")),
        content: String(post.content?.rendered ?? ""),
      }))
      .filter((post) => post.link && post.content);
  } catch (error) {
    return Response.json({ error: `archive unavailable: ${String(error)}` }, { status: 502 });
  }

  const now = new Date().toISOString();
  const tally = {
    outlet: outlet.key,
    query,
    posts: posts.length,
    articles: 0,
    findings: 0,
    duplicates: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const post of posts) {
    try {
      const existing = await db
        .prepare("SELECT id FROM documents WHERE url = ? LIMIT 1")
        .bind(post.link)
        .all();
      if ((existing.results ?? []).length) {
        tally.skipped += 1;
        continue;
      }

      const bodyText = articleText(post.content).slice(0, 80_000);
      // The title is part of the stored text so a finding stated only in the
      // headline still has a passage the reader can check.
      const text = `${post.title}\n\n${bodyText}`;
      if (bodyText.length < 200) continue;
      const findings = extractFindings(bodyText, post.title);
      if (!findings.length) continue;

      const docId = `doc:news:${await sha16(post.link)}`;
      const hash = await sha16(text);
      const writes: ReturnType<D1["prepare"]>[] = [
        db
          .prepare(
            `INSERT INTO documents
               (id, kind, issuer, title, number, url, published_at, retrieved_at,
                content_hash, locator, provenance, self_serving, text_excerpt,
                fetched_at, http_status, parsed_at)
             VALUES (?, 'press', ?, ?, '', ?, ?, ?, ?, '', ?, 0, ?, ?, 200, ?)`,
          )
          .bind(
            docId,
            outlet.name,
            post.title.slice(0, 300),
            post.link,
            post.date || now.slice(0, 10),
            now,
            hash,
            `${outlet.name} archive search "${query}"`,
            text,
            now,
            now,
          ),
      ];

      const flat = text.replace(/\s+/g, " ");
      for (const finding of findings) {
        // Sentences are whitespace-normalised when they are cut out of the
        // article, so compare against a flattened copy of the stored text.
        if (!flat.includes(finding.quote.replace(/\s+/g, " "))) {
          tally.errors.push(`${post.link}: quote not in stored text`);
          continue;
        }

        const slug = slugify(finding.name);
        const known = await db
          .prepare("SELECT id FROM entities WHERE lower(name) = lower(?) AND kind = 'person' LIMIT 1")
          .bind(finding.name)
          .first<{ id: string }>();
        const entityId = known?.id ? String(known.id) : `person:${slug}`;

        if (!known?.id) {
          writes.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO entities
                   (id, kind, name, slug, aliases, country, affiliation, role, external_ids, created_at, updated_at)
                 VALUES (?, 'person', ?, ?, '[]', '', '', '', '{}', ?, ?)`,
              )
              .bind(entityId, finding.name, slug, now, now),
          );
        }

        const act = finding.act.slice(0, 300);
        const offense = (finding.offense || act).toLowerCase().replace(/\s+/g, " ").trim();
        // One row per person per finding per offence. The same conviction
        // repeated by five outlets is one finding, not five.
        const claimKey = `${entityId}|${finding.finding}|${offense}`;
        const claimId = `claim:finding:${await sha16(claimKey)}`;
        const already = await db
          .prepare("SELECT id FROM claims WHERE claim_key = ? LIMIT 1")
          .bind(claimKey)
          .first<{ id: string }>();
        if (already?.id) {
          tally.duplicates += 1;
          continue;
        }
        const confidence = confidenceOf(finding);
        const basis = `${outlet.name}, "${post.title.slice(0, 160)}" (${post.date}); sentence located in the stored article; not independently verified`;
        const year = yearOf(finding.quote);

        writes.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO claims
                 (id, entity_id, act, category, mechanism, beneficiary, act_date,
                  date_precision, amount, currency, confidence, confidence_basis,
                  status, finding, claim_key, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, '', ?, ?, NULL, '', ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              claimId,
              entityId,
              act,
              finding.category,
              outlet.name,
              year ? `${year}-01-01` : null,
              year ? "year" : "unknown",
              confidence,
              basis,
              finding.finding,
              finding.finding,
              claimKey,
              now,
              now,
            ),
          db
            .prepare(
              `INSERT OR REPLACE INTO claim_documents (claim_id, document_id, quote, locator, stance)
               VALUES (?, ?, ?, 'article sentence', 'reports')`,
            )
            .bind(claimId, docId, finding.quote),
          db
            .prepare(
              "INSERT OR REPLACE INTO claim_entities (claim_id, entity_id, role) VALUES (?, ?, 'actor')",
            )
            .bind(claimId, entityId),
        );
        tally.findings += 1;
      }

      await batchWrite(db, writes);
      tally.articles += 1;
    } catch (error) {
      tally.errors.push(`${post.link}: ${String(error).slice(0, 160)}`);
    }
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('findings', ?, ?, ?, ?)",
      )
      .bind(now, new Date().toISOString(), tally.findings, tally.errors[0] ?? null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json({ ok: true, ...tally }, { headers: { "Cache-Control": "no-store" } });
}
