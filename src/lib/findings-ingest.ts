import type { D1 } from "@/lib/clock-store";
import { slugify } from "@/lib/slug";
import { canonicalFromAlias, loadPersonIndex, noteAlias, resolveInIndex } from "@/lib/person-index";
import {
  articleText,
  extractFindings,
  OUTLETS,
  searchUrl,
  type Finding,
  type Post,
} from "@/lib/findings";

/**
 * The ingest itself, kept out of the route so the cron can run the same code.
 *
 * The article is the document; the sentence that states the finding is the
 * claim; the person is created from the article. Nothing has to be in a roster,
 * and no official register is consulted.
 */

const UA = "AdaGuillotine/1.0 (findings)";
const BATCH = 50;

export interface IngestTally {
  outlet: string;
  query: string;
  posts: number;
  articles: number;
  findings: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

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

/** Search one outlet for one finding word, and write what the articles name. */
export async function ingestFindings(
  db: D1,
  outletKey: string,
  query: string,
  per: number,
  after = "2020-01-01T00:00:00",
): Promise<IngestTally> {
  const outlet = OUTLETS.find((entry) => entry.key === outletKey);
  if (!outlet) {
    throw new Error(`unknown outlet ${outletKey}`);
  }

  let posts: Post[] = [];
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

  const now = new Date().toISOString();
  // The record's own spellings decide who this is. Exact match alone filed
  // "Donald J. Trump" as a second person beside "Donald Trump", with half the
  // findings on a row the line page never reads.
  const index = await loadPersonIndex(db);
  const tally: IngestTally = {
    outlet: outlet.key,
    query,
    posts: posts.length,
    articles: 0,
    findings: 0,
    duplicates: 0,
    skipped: 0,
    errors: [],
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
        let known = resolveInIndex(index, finding.name);
        if (!known) {
          const canonical = await canonicalFromAlias(db, finding.name);
          if (canonical) known = resolveInIndex(index, canonical);
        }
        const entityId = known?.id ? String(known.id) : `person:${slug}`;

        if (known) {
          // The person is already on the record under another spelling. Write
          // the alias and file the claim against that record, so the page the
          // line shows is the page these findings land on. The entity row is
          // written as well: a queue row without one would take a claim the
          // archive's join cannot see.
          await noteAlias(db, finding.name, known.name, now);
          writes.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO entities
                   (id, kind, name, slug, aliases, country, affiliation, role, external_ids, created_at, updated_at)
                 VALUES (?, 'person', ?, ?, '[]', '', '', '', '{}', ?, ?)`,
              )
              .bind(known.id, known.name, slugify(known.name), now, now),
          );
        } else {
          writes.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO entities
                   (id, kind, name, slug, aliases, country, affiliation, role, external_ids, created_at, updated_at)
                 VALUES (?, 'person', ?, ?, '[]', '', '', '', '{}', ?, ?)`,
              )
              .bind(entityId, finding.name, slug, now, now),
          );
          // Later findings in this same pass must find the row just written,
          // or two spellings of it would each become their own entity.
          index.push({ id: entityId, name: finding.name });
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
                  status, finding, claim_key, document_id, quote, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, '', ?, ?, NULL, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
              docId,
              finding.quote,
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

  return tally;
}
