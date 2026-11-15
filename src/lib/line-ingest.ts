import type { D1 } from "@/lib/clock-store";
import { slugify } from "@/lib/slug";
import { articleText, OUTLETS, searchUrl, type Post } from "@/lib/findings";

/**
 * The line pass: the people under the blade, read by name.
 *
 * The finding pass looks for convictions and finds small fry. This one looks
 * for the people who own the system and the acts that keep them there: money
 * moving into politics, contracts, monopolies, surveillance, labour, war. It
 * does not need a conviction. The source sentence is the record.
 */

const UA = "AdaGuillotine/1.0 (line)";
const BATCH = 50;

/** Sentences about power, money, or the use of either. */
const SIGNAL =
  /(?:\$|£|€)\s?\d|\bmillion\b|\bbillion\b|\bcontract\b|\bdonat|\blobby|\binvest|\bstake\b|\bshares?\b|\bcampaign\b|\bsuper pac\b|\bpac\b|\bfund\b|\bloan\b|\btax\b|\bsubsid|\bsanction|\blawsuit|\bsettl|\bfine\b|\bprofit|\blayoff|\bunion\b|\bsurveillance|\bweapon|\barms\b|\bdeal\b|\bmeeting\b|\bpressure|\binfluence|\bconflict of interest|\bethics\b|\bprobe\b|\binvestigat|\balleg|\baccus|\bacqui|\bbought\b|\bsold\b|\bmerg|\bmonopol|\bprice|\brent\b|\bevict|\bpollut|\bemission|\bprison\b|\bdetention|\bdeport|\bcoup\b|\bairstrike|\btroops\b|\bkill|\bgenocide|\bcrackdown|\bpropaganda|\bdisinformation/i;

function categoryOf(sentence: string): string {
  const s = sentence.toLowerCase();
  if (/genocide|ethnic cleansing|massacre|kill|airstrike|troops|war crime/.test(s)) return "war";
  if (/weapon|arms|missile|drone|defen[cs]e contract|military/.test(s)) return "arms";
  if (/surveillance|spy|police|prison|detention|deport|crackdown|protest|journalist/.test(s)) {
    return "repression";
  }
  if (/lobby|donat|campaign|super pac|\bpac\b|influence|conflict of interest|ethics|revolving door/.test(s)) {
    return "influence";
  }
  if (/media|newspaper|broadcast|platform|algorithm|disinformation|propaganda/.test(s)) return "media";
  if (/tax|subsid|profit|loan|fund|invest|stake|shares|merger|monopol|price|rent/.test(s)) {
    return "finance";
  }
  if (/contract|procurement|no-bid|tender/.test(s)) return "finance";
  if (/labour|worker|union|layoff|wage|injury/.test(s)) return "labour";
  if (/climate|emission|pollut|oil|gas|coal|environment/.test(s)) return "climate";
  if (/mining|timber|land|water|resource|extract/.test(s)) return "extraction";
  return "impunity";
}

async function sha16(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z“"'(])/u)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 700);
}

/** The sentence must be about the name, not merely mention it in passing. */
const ACTION =
  /\b(invested|donat|gave|spent|bought|sold|acquir|won|receiv|paid|lobbied|lobbying|push|press|urged|met with|holds?|owns?|controls?|runs?|founded|funded|backed|profit|launch|expand|cut|laid off|sued|settl|fined|sanctioned|awarded|granted|approved|signed|ordered|deployed|struck|bombed|killed|detained|deported|surveill|monopol|raised|donated|contributed|invested|acquired)\w*/i;

function mentionsName(sentence: string, name: string): boolean {
  const lower = sentence.toLowerCase();
  const full = name.toLowerCase();
  const surname = (name.split(/\s+/).pop() ?? "").toLowerCase();
  if (surname.length < 4) return false;
  const at = [lower.indexOf(full), lower.indexOf(surname)].filter((i) => i >= 0);
  if (!at.length) return false;
  const index = Math.min(...at);
  // A name buried after the first clause is usually a modifier, not the actor.
  if (index > 60) return false;
  // If it is not the opening subject, it needs a possessive or "whose" to be
  // the thing the sentence is about.
  if (index > 0) {
    const escaped = surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`\\b${escaped}(?:'s|’s|\\s*,\\s*whose)\\b`, "i").test(sentence)) {
      return false;
    }
  }
  return ACTION.test(sentence);
}

export interface LineTally {
  person: string;
  outlet: string;
  posts: number;
  articles: number;
  acts: number;
  skipped: number;
  errors: string[];
}

export async function ingestLinePerson(
  db: D1,
  personName: string,
  outletKey: string,
  per = 20,
): Promise<LineTally> {
  const outlet = OUTLETS.find((entry) => entry.key === outletKey);
  if (!outlet) throw new Error(`unknown outlet ${outletKey}`);

  const response = await fetch(searchUrl(outlet, personName, per), {
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

  const posts: Post[] = body
    .map((post) => ({
      date: String(post.date ?? "").slice(0, 10),
      link: String(post.link ?? ""),
      title: articleText(String(post.title?.rendered ?? "")),
      content: String(post.content?.rendered ?? ""),
    }))
    .filter((post) => post.link && post.content);

  const now = new Date().toISOString();
  const tally: LineTally = {
    person: personName,
    outlet: outlet.key,
    posts: posts.length,
    articles: 0,
    acts: 0,
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

      const text = articleText(post.content).slice(0, 80_000);
      if (text.length < 200) continue;
      const hits = sentencesOf(text)
        .filter((sentence) => mentionsName(sentence, personName) && SIGNAL.test(sentence))
        .slice(0, 6);
      if (!hits.length) continue;

      const entity = await db
        .prepare("SELECT id FROM entities WHERE lower(name) = lower(?) AND kind = 'person' LIMIT 1")
        .bind(personName)
        .first<{ id: string }>();
      const entityId = entity?.id ? String(entity.id) : `person:${slugify(personName)}`;
      if (!entity?.id) {
        await db
          .prepare(
            `INSERT OR IGNORE INTO entities
               (id, kind, name, slug, aliases, country, affiliation, role, external_ids, created_at, updated_at)
             VALUES (?, 'person', ?, ?, '[]', '', '', '', '{}', ?, ?)`,
          )
          .bind(entityId, personName, slugify(personName), now, now)
          .run();
      }

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
            `${outlet.name} name search "${personName}"`,
            text,
            now,
            now,
          ),
      ];

      for (const sentence of hits) {
        const act = sentence.slice(0, 300);
        const claimKey = `${entityId}|act|${await sha16(act.toLowerCase())}`;
        const claimId = `claim:line:${await sha16(claimKey)}`;
        const already = await db
          .prepare("SELECT id FROM claims WHERE claim_key = ? LIMIT 1")
          .bind(claimKey)
          .first<{ id: string }>();
        if (already?.id) continue;

        const year = [...sentence.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => m[1]).pop();

        writes.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO claims
                 (id, entity_id, act, category, mechanism, beneficiary, act_date,
                  date_precision, amount, currency, confidence, confidence_basis,
                  status, finding, claim_key, document_id, quote, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, '', ?, ?, NULL, '', ?, ?, 'recorded', 'none', ?, ?, ?, ?, ?)`,
            )
            .bind(
              claimId,
              entityId,
              act,
              categoryOf(sentence),
              outlet.name,
              year ? `${year}-01-01` : null,
              year ? "year" : "unknown",
              0.55,
              `${outlet.name}, "${post.title.slice(0, 160)}" (${post.date}); name and act in the stored article`,
              claimKey,
              docId,
              sentence,
              now,
              now,
            ),
          db
            .prepare(
              `INSERT OR REPLACE INTO claim_documents (claim_id, document_id, quote, locator, stance)
               VALUES (?, ?, ?, 'article sentence', 'reports')`,
            )
            .bind(claimId, docId, sentence),
          db
            .prepare(
              "INSERT OR REPLACE INTO claim_entities (claim_id, entity_id, role) VALUES (?, ?, 'actor')",
            )
            .bind(claimId, entityId),
        );
        tally.acts += 1;
      }

      for (let i = 0; i < writes.length; i += BATCH) {
        const chunk = writes.slice(i, i + BATCH);
        if (db.batch) await db.batch(chunk);
        else for (const statement of chunk) await statement.run();
      }
      tally.articles += 1;
    } catch (error) {
      tally.errors.push(`${post.link}: ${String(error).slice(0, 160)}`);
    }
  }

  return tally;
}
