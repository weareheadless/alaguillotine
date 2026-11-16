import type { D1 } from "@/lib/clock-store";
import { slugify } from "@/lib/slug";
import { articleText, searchUrl, OUTLETS } from "@/lib/findings";
import { canonicalFromAlias, loadPersonIndex, noteAlias, resolveInIndex } from "@/lib/person-index";
import { backgroundReference, surnameOf } from "@/lib/person-name";

/**
 * Discovery: find names the line does not have yet.
 *
 * The line pass reads the cast by name. This pass reads the reporting for the
 * ways power is used — dark money, contracts, lobbying, shell companies — and
 * takes the people the sentences name. A name enters only with a role word and
 * a money/power signal in the same sentence, and the sentence is stored as the
 * passage. No roster decides who can be found.
 */

const UA = "AdaGuillotine/1.0 (discovery)";
const BATCH = 50;

export const POWER_QUERIES = [
  "dark money",
  "super PAC",
  "lobbying",
  "government contract",
  "conflict of interest",
  "oligarch",
  "shell company",
  "tax avoidance",
  "billionaire donor",
  "revolving door",
  "campaign donation",
  "private equity",
  "sovereign wealth fund",
  "monopoly",
  "sanctions evasion",
  "influence peddling",
];

const SIGNAL =
  /(?:\$|£|€)\s?\d|\bmillion\b|\bbillion\b|\bcontract\b|\bdonat|\blobby|\binvest|\bstake\b|\bshares?\b|\bcampaign\b|\bsuper pac\b|\bfund\b|\bloan\b|\btax\b|\bsubsid|\bsanction|\blawsuit|\bsettl|\bfine\b|\bprofit|\bmonopol|\bprice|\brent\b|\bprison\b|\bdetention|\bdeport|\bcoup\b|\btroops\b|\bgenocide|\bcrackdown|\bpropaganda|\bdisinformation|\bcontracts?\b|\bprocurement\b/i;

const ROLE_WORDS =
  "billionaire|millionaire|oligarch|donor|lobbyist|minister|president|prime minister|senator|congressman|congresswoman|governor|mayor|CEO|chief executive|co-?founder|founder|chairman|chairwoman|investor|banker|contractor|adviser|advisor|secretary|director|executive|tycoon|magnate|heir|heiress|prince|sheikh|general|commander";
const ROLE = new RegExp(`\\b(?:${ROLE_WORDS})\\b`, "i");

const ROLE_SET = new Set([
  "billionaire", "millionaire", "oligarch", "donor", "lobbyist", "minister",
  "president", "senator", "congressman", "congresswoman", "governor", "mayor",
  "ceo", "executive", "founder", "co-founder", "cofounder", "chairman",
  "chairwoman", "chair", "investor", "banker", "contractor", "adviser",
  "advisor", "secretary", "director", "tycoon", "magnate", "heir", "heiress",
  "prince", "sheikh", "general", "commander", "proprietor", "backer",
]);

const NAME_WORD = /^\p{Lu}[\p{L}'’.-]*$/u;
const FILLER = new Set(["the", "a", "an", "its", "their", "is", "was", "and", "of"]);

/**
 * A person is named beside the office, not merely in a sentence that has one:
 * "billionaire Jeffrey Yass", "Viktor Orbán, the prime minister". The loose
 * test kept captions and headlines alive because a role word appeared ten
 * clauses away.
 *
 * Token walking rather than a regex: a case-insensitive regex on `[A-Z]`
 * matches lowercase too, which quietly accepted "Congressman Clyburn of".
 */
function roleLead(before: string): boolean {
  // "under President X", "while President X": the office is a background
  // reference to the previous administration, not the actor of the sentence.
  if (backgroundReference(before)) return false;
  const tokens = before.trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) return false;
  for (let i = 1; i <= 3 && i <= tokens.length; i += 1) {
    const token = tokens[tokens.length - i];
    const bare = token.toLowerCase().replace(/[.,:;]$/, "");
    if (ROLE_SET.has(bare)) return true;
    if (!NAME_WORD.test(token)) return false;
  }
  return false;
}

function roleTail(after: string): boolean {
  // Only an appositive names the office of the person before it: "Viktor Orbán,
  // the prime minister", "Jami LaRue, a donor". A role word that simply follows
  // ("Hungarian Prime Minister") is part of the title, not a description.
  if (!/^\s*(?:,|—|–|\bis\b|\bwas\b)/.test(after)) return false;
  const tokens = after.trim().split(/[\s,]+/).filter(Boolean);
  for (let i = 0; i < Math.min(5, tokens.length); i += 1) {
    const token = tokens[i];
    const bare = token.toLowerCase().replace(/[.,:;]$/, "");
    if (FILLER.has(bare)) continue;
    if (ROLE_SET.has(bare)) return true;
    if (!NAME_WORD.test(token)) return false;
  }
  return false;
}

const ACTION =
  /\b(invested|donat|gave|spent|bought|sold|acquir|won|receiv|paid|lobbied|lobbying|push|press|urged|holds?|owns?|controls?|runs?|founded|funded|backed|profit|launch|expand|cut|laid off|sued|settl|fined|sanctioned|awarded|granted|approved|signed|ordered|deployed|struck|bombed|killed|detained|deported|surveill|monopol|raised|contributed)\w*/i;

/**
 * Names as they appear in running copy, then a hard filter.
 *
 * A capitalised pair is not a person: captions, photo credits and navigation
 * text ("Getty Images", "Related Mike Rogers", "SUBSCRIBE TODAY") all pass the
 * shape test. A discovered name becomes an entity and a queue row, so the
 * cost of a false one is a person page about a stock photo agency. The name
 * has to stand beside a role word and survive the vocabulary below.
 */
const TITLE = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof", "professor", "sir", "dame", "lord", "lady",
  "president", "vice", "senator", "sen", "representative", "rep", "congressman",
  "congresswoman", "governor", "gov", "mayor", "minister", "secretary", "director",
  "general", "commander", "prince", "sheikh", "judge", "justice", "rev", "cllr",
  "councillor", "chancellor", "ambassador",
]);

const NOT_A_NAME = new Set([
  // firms, funds and the furniture of a page
  "images", "image", "charitable", "pac", "inc", "ltd", "llc", "corp", "corporation",
  "group", "fund", "funds", "foundation", "trust", "capital", "partners", "bank",
  "times", "post", "news", "edition", "uk", "us", "usa", "party", "committee",
  "council", "agency", "department", "ministry", "university", "institute",
  "association", "union", "exchange", "jets", "exports", "licensing", "operations",
  "strategic", "vanguard", "save", "democracy", "greater", "reform", "operation",
  "private", "military", "subscribe", "today", "updates", "related", "thanks",
  "story", "photo", "video", "advertisement", "read", "more", "click", "here",
  "sign", "newsletter", "byline", "herald", "journal", "review", "observer",
  "guardian", "telegraph", "mirror", "sun", "star", "mail", "express", "report",
  "reports", "reported", "according", "meanwhile", "however", "but", "and",
  "who", "whom", "whose", "which", "that", "this", "these", "those", "called",
  "said", "says", "told", "asked", "added", "including", "among", "about",
  "against", "into", "than", "then", "there", "here", "where", "when",
  // modals and connectives: a headline window ("Donor Could Profit") is not a
  // person, and neither is any two-word slice of one
  "could", "would", "should", "will", "may", "might", "must", "can", "from",
  "after", "before", "over", "under", "with", "without", "for", "nor", "yet",
  "profit", "profits", "tax", "taxes", "money", "deal", "deals", "contract",
  "contracts", "donor", "donors", "gift", "gifts", "dark", "shell", "super",
  "billionaire", "millionaire", "oligarch", "lobbyist", "ceo", "founder",
  "investor", "banker", "executive", "chairman", "chairwoman", "tycoon",
  // a suffix is not a surname: "Lehi Jr." is the same man as "Lehi"
  "jr", "sr", "ii", "iii", "iv",
]);

function validName(raw: string): string | null {
  // A sentence-final period is punctuation, not part of the name.
  const words = (raw.match(/[\p{L}][\p{L}'’.-]*/gu) ?? []).map((word) =>
    word.length > 2 ? word.replace(/\.$/, "") : word,
  );
  if (!words.length) return null;
  const leading = (word: string): boolean => {
    const bare = word.toLowerCase().replace(/[.,]/g, "");
    return TITLE.has(bare) || ROLE_SET.has(bare);
  };
  while (words.length > 1 && leading(words[0])) words.shift();
  if (words.length < 2 || words.length > 3) return null;
  if (NOT_A_NAME.has(words[0].toLowerCase().replace(/[.,]/g, ""))) return null;
  // A surname is a name, not an initial: "David H." is a fragment.
  if (words[words.length - 1].replace(/\.$/, "").length < 2) return null;
  for (const word of words) {
    if (!/^[A-Z][\p{L}'’.-]*$/u.test(word)) return null;
    if (word.length < 2 && !/^[A-Z]\.$/.test(word)) return null;
    if (NOT_A_NAME.has(word.toLowerCase().replace(/[.,]/g, ""))) return null;
    if (/['’](s|re|t|ve|ll|d|m)\b/i.test(word)) return null;
  }
  if (words.every((word) => word === word.toUpperCase())) return null;
  return words.join(" ");
}

/** A name is only taken when a role word sits beside it, not merely in the sentence. */
export function powerNames(sentence: string): string[] {
  const names: string[] = [];
  const words: Array<{ text: string; start: number; end: number }> = [];
  for (const match of sentence.matchAll(/[\p{L}][\p{L}'’.-]*/gu)) {
    const start = match.index ?? 0;
    words.push({ text: match[0], start, end: start + match[0].length });
  }

  for (let i = 0; i < words.length; i += 1) {
    if (!NAME_WORD.test(words[i].text)) continue;
    // Two and three word windows over consecutive capitalised words. Taken
    // longest first so "James Clyburn" is preferred to "Clyburn" alone.
    for (let length = 3; length >= 2; length -= 1) {
      if (i + length > words.length) continue;
      let candidate = words[i].text;
      let joined = true;
      for (let k = i + 1; k < i + length; k += 1) {
        const gap = sentence.slice(words[k - 1].end, words[k].start);
        if (!/^\s+$/.test(gap) || !NAME_WORD.test(words[k].text)) {
          joined = false;
          break;
        }
        candidate += ` ${words[k].text}`;
      }
      if (!joined) continue;
      const start = words[i].start;
      const stop = words[i + length - 1].end;
      const before = sentence.slice(Math.max(0, start - 60), start);
      const after = sentence.slice(stop, stop + 70);
      if (!roleLead(before) && !roleTail(after)) continue;
      const name = validName(candidate);
      if (!name || names.includes(name)) continue;
      names.push(name);
      if (names.length >= 3) return names;
    }
  }
  return names;
}

/** The article refers to the name as a person somewhere, not only as a party. */
function hasPersonEvidence(sentences: string[], name: string): boolean {
  const surname = surnameOf(name);
  if (!surname) return false;
  return sentences.some((sentence) => {
    if (!sentence.toLowerCase().includes(surname)) return false;
    return /\b(he|she|his|her|him|hers|himself|herself)\b/i.test(sentence);
  });
}

/** A nineteenth-century reference is history, not a current act. */
function historical(sentence: string): boolean {
  const years = [...sentence.matchAll(/\b(1[89]\d{2}|20\d{2})\b/g)].map((m) => Number(m[1]));
  return years.length > 0 && Math.max(...years) < 1990;
}

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
    .filter((sentence) => sentence.length >= 50 && sentence.length <= 700);
}

export interface DiscoveryTally {
  outlet: string;
  query: string;
  posts: number;
  articles: number;
  acts: number;
  names: string[];
  newNames: string[];
  skipped: number;
  errors: string[];
}

export async function discoverPower(
  db: D1,
  outletKey: string,
  query: string,
  per = 15,
): Promise<DiscoveryTally> {
  const outlet = OUTLETS.find((entry) => entry.key === outletKey);
  if (!outlet) throw new Error(`unknown outlet ${outletKey}`);

  const response = await fetch(searchUrl(outlet, query, per), {
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
  const posts = body
    .map((post) => ({
      date: String(post.date ?? "").slice(0, 10),
      link: String(post.link ?? ""),
      title: articleText(String(post.title?.rendered ?? "")),
      content: String(post.content?.rendered ?? ""),
    }))
    .filter((post) => post.link && post.content);

  const now = new Date().toISOString();
  const index = await loadPersonIndex(db);
  const tally: DiscoveryTally = {
    outlet: outlet.key,
    query,
    posts: posts.length,
    articles: 0,
    acts: 0,
    names: [],
    newNames: [],
    skipped: 0,
    errors: [],
  };
  const seenNames = new Set<string>();

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

      const sentences = sentencesOf(text);
      const hits: Array<{ sentence: string; names: string[] }> = [];
      for (const sentence of sentences) {
        if (historical(sentence)) continue;
        if (!ROLE.test(sentence) || !SIGNAL.test(sentence) || !ACTION.test(sentence)) continue;
        // A company is not a person: "Lockheed Martin" can sit beside the word
        // "general" and still be an issuer. Somewhere in the article the name
        // has to be referred to as he or she.
        const names = powerNames(sentence).filter((name) =>
          hasPersonEvidence(sentences, name),
        );
        if (names.length) hits.push({ sentence, names });
        if (hits.length >= 4) break;
      }
      if (!hits.length) continue;

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
            `${outlet.name} discovery search "${query}"`,
            text,
            now,
            now,
          ),
      ];

      for (const hit of hits) {
        for (const name of hit.names) {
          const slug = slugify(name);
          let known = resolveInIndex(index, name);
          if (!known) {
            const canonical = await canonicalFromAlias(db, name);
            if (canonical) known = resolveInIndex(index, canonical);
          }
          const entityId = known?.id ? String(known.id) : `person:${slug}`;

          if (known) {
            // The record already holds this person under another spelling.
            // Write the alias so the scorer and the archive use one key, and
            // file the act under that person rather than a second page.
            await noteAlias(db, name, known.name, now);
            await db
              .prepare(
                `INSERT OR IGNORE INTO entities
                   (id, kind, name, slug, aliases, country, affiliation, role, external_ids, created_at, updated_at)
                 VALUES (?, 'person', ?, ?, '[]', '', '', '', '{}', ?, ?)`,
              )
              .bind(known.id, known.name, slugify(known.name), now, now)
              .run();
          } else {
            const role = (ROLE.exec(hit.sentence)?.[0] ?? "").toLowerCase();
            await db
              .prepare(
                `INSERT OR IGNORE INTO entities
                   (id, kind, name, slug, aliases, country, affiliation, role, external_ids, created_at, updated_at)
                 VALUES (?, 'person', ?, ?, '[]', '', '', ?, '{}', ?, ?)`,
              )
              .bind(entityId, name, slug, role, now, now)
              .run();
            index.push({ id: entityId, name });
            // A discovered name joins the line at once, so the name pass reads
            // it next cycle and the record grows without another roster edit.
            // Its own sentence is the receipt: the queue pass keeps a name that
            // has an act on the record and drops one that never had any.
            if (tally.newNames.length < 8) {
              await db
                .prepare(
                  `INSERT OR IGNORE INTO queue_people
                     (id, name, slug, role, country, reason, score, mentions, rank,
                      prev_rank, added_at, last_seen_at, dropped_at, items, source,
                      source_url, record_bonus)
                   VALUES (?, ?, ?, ?, '', ?, 0, 0,
                           (SELECT COALESCE(MAX(rank), 0) + 1 FROM queue_people),
                           NULL, ?, ?, NULL, '[]', 'discovery', ?, 0)`,
                )
                .bind(
                  slug,
                  name,
                  slug,
                  role,
                  hit.sentence.slice(0, 300),
                  now,
                  now,
                  post.link,
                )
                .run();
              tally.newNames.push(name);
            }
          }
          if (!seenNames.has(name)) {
            seenNames.add(name);
            tally.names.push(name);
          }

          const act = hit.sentence.slice(0, 300);
          const claimKey = `${entityId}|discovery|${await sha16(act.toLowerCase())}`;
          const claimId = `claim:discovery:${await sha16(claimKey)}`;
          const already = await db
            .prepare("SELECT id FROM claims WHERE claim_key = ? LIMIT 1")
            .bind(claimKey)
            .first<{ id: string }>();
          if (already?.id) continue;

          const year = [...hit.sentence.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => m[1]).pop();
          // The record is dated by what the source says. A bare year is placed
          // mid-year, the same guess the scorer makes for an undated act; a
          // sentence with no date at all is dated to the report, because the
          // reporting is the evidence the line is standing on.
          const actDate = year ? `${year}-07-01` : post.date || now.slice(0, 10);
          const precision = year ? "year" : "reported";
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
                categoryOf(hit.sentence),
                outlet.name,
                actDate,
                precision,
                0.5,
                `${outlet.name}, "${post.title.slice(0, 160)}" (${post.date}); role and act in the stored article`,
                claimKey,
                docId,
                hit.sentence,
                now,
                now,
              ),
            db
              .prepare(
                `INSERT OR REPLACE INTO claim_documents (claim_id, document_id, quote, locator, stance)
                 VALUES (?, ?, ?, 'article sentence', 'reports')`,
              )
              .bind(claimId, docId, hit.sentence),
            db
              .prepare(
                "INSERT OR REPLACE INTO claim_entities (claim_id, entity_id, role) VALUES (?, ?, 'actor')",
              )
              .bind(claimId, entityId),
          );
          tally.acts += 1;
        }
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
