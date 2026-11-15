/**
 * Press as a document class, bounded.
 *
 * The register's other connectors read paperwork: a roll call, a filing, a
 * register. Journalism is the class that names people no roster contains, and
 * it is also the class most able to turn a site into a rumour mill. The way in
 * is not to trust it more, it is to read less of it and quote precisely:
 *
 *   - six published feeds, read as feeds (no scraping behind a paywall);
 *   - an item is considered only if its own text names a tracked person;
 *   - the claim is one sentence containing that name, stored verbatim;
 *   - the claim is `reported` by default and `alleged` only when the sentence
 *     carries an allegation, and either way `finding` is set explicitly;
 *   - repetition is not evidence: a second outlet attaches to the same claim
 *     only when the act and date match, otherwise it is its own row.
 *
 * The feed text is often only a summary, so a short item that already names
 * someone is fetched once, capped, to give the sentence somewhere to live.
 */

export interface PressFeed {
  key: string;
  issuer: string;
  url: string;
}

export const PRESS_FEEDS: PressFeed[] = [
  {
    key: "bbc",
    issuer: "BBC News",
    url: "https://feeds.bbci.co.uk/news/politics/rss.xml",
  },
  {
    key: "guardian",
    issuer: "The Guardian",
    url: "https://www.theguardian.com/politics/rss",
  },
  {
    key: "sky",
    issuer: "Sky News",
    url: "https://feeds.skynews.com/feeds/rss/politics.xml",
  },
  {
    key: "npr",
    issuer: "NPR",
    url: "https://feeds.npr.org/1001/rss.xml",
  },
  {
    key: "propublica",
    issuer: "ProPublica",
    url: "https://www.propublica.org/feeds/propublica/main",
  },
  {
    key: "aljazeera",
    issuer: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
];

export interface FeedItem {
  title: string;
  link: string;
  published: string;
  body: string;
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

/** HTML to readable text, keeping paragraph breaks where they were. */
export function pressText(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return match ? decode(match[1]).trim() : "";
}

function linkOf(block: string): string {
  const plain = /<link(?:\s[^>]*)?>([^<]+)<\/link>/i.exec(block);
  if (plain) return decode(plain[1]).trim();
  const href = /<link[^>]*href=["']([^"']+)["']/i.exec(block);
  return href ? decode(href[1]).trim() : "";
}

function dateOf(block: string): string {
  const raw =
    tag(block, "pubDate") ||
    tag(block, "dc:date") ||
    tag(block, "published") ||
    tag(block, "updated");
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return "";
  return new Date(at).toISOString().slice(0, 10);
}

export function parseFeed(xml: string): FeedItem[] {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((match) => match[0]);

  const items: FeedItem[] = [];
  for (const block of blocks) {
    const link = linkOf(block);
    if (!link) continue;
    const body =
      tag(block, "content:encoded") ||
      tag(block, "description") ||
      tag(block, "summary") ||
      tag(block, "content");
    items.push({
      title: pressText(tag(block, "title")),
      link,
      published: dateOf(block),
      body: pressText(body),
    });
  }
  return items;
}

/** The allegation words. Presence makes a passage `alleged`, never `found`. */
const MISDEED =
  /\b(charged|indicted|convicted|conviction|pleaded|plea deal|sentenced|fraud|fraudulent|bribery|bribed|corrupt|corruption|sanctioned|sanctions|laundering|embezzl\w*|misconduct|abused|abuse|illegal|unlawful|investigat\w*|probe|alleged|allegation\w*|accused|lawsuit|sued|settled|settlement|contempt|obstruction|perjur\w*|kickback\w*|nepotism|trafficking|smuggl\w*|exploited|exploitation)\b/i;

export function isAllegation(sentence: string): boolean {
  return MISDEED.test(sentence);
}

/**
 * An act-shaped sentence: the person is the subject, and something happens.
 *
 * "Andy Burnham was the only G7 leader to make the trip" names him and is not
 * an act of his; "Kruger made a concession that ... Andy Burnham" is about
 * Kruger. Requiring the name in the first half and an action verb removes most
 * of that, and a missed sentence costs nothing.
 */
const ACT =
  /\b(said|says|told|announced|pledged|promised|signed|voted|approved|rejected|ordered|appointed|resigned|launched|cut|cuts|raised|spent|awarded|paid|received|bought|sold|met|visited|warned|accused|charged|denied|admitted|threatened|banned|blocked|fired|hired|set out|sets out|backs|backed|urged|called for|defended|attacked|criticised|criticized|granted|won|lost|axed|scrapped|introduced|published|testified|pleaded|convicted|investigated)\b/i;

export function isActShaped(sentence: string, needle: string): boolean {
  const words = normaliseName(sentence).split(" ");
  const name = needle.split(" ");
  const at = words.indexOf(name[0]);
  // The subject comes early. "That led climate skeptics, including President
  // Donald Trump, to say..." is about the skeptics, however often it names him.
  if (at < 0 || at > 5) return false;
  const after = words.slice(at + name.length, at + name.length + 16).join(" ");
  return ACT.test(after);
}

/** One lower-case, punctuation-free stream for name matching. */
export function normaliseName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface GazetteerEntry {
  id: string;
  name: string;
  needles: string[];
}

/** Full names and aliases of two or more words: a single token is a guess. */
export function needlesFor(name: string, aliases: string): string[] {
  const values = [name, ...safeAliases(aliases)];
  const needles = new Set<string>();
  for (const value of values) {
    const normal = normaliseName(value);
    if (normal.split(" ").length < 2 || normal.length < 6) continue;
    needles.add(normal);
  }
  return [...needles];
}

function safeAliases(aliases: string): string[] {
  try {
    const parsed = JSON.parse(aliases || "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export interface Hit {
  entry: GazetteerEntry;
  needle: string;
}

/** Which tracked people does this text name? Word boundaries, not substrings. */
export function findPeople(text: string, gazetteer: GazetteerEntry[]): Hit[] {
  const haystack = ` ${normaliseName(text)} `;
  const hits: Hit[] = [];
  for (const entry of gazetteer) {
    for (const needle of entry.needles) {
      if (haystack.includes(` ${needle} `)) {
        hits.push({ entry, needle });
        break;
      }
    }
  }
  return hits;
}

/** The sentence that names the person, long enough to mean something. */
export function sentenceFor(text: string, needle: string): string | null {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 60 && sentence.length <= 400);
  for (const sentence of sentences) {
    if (` ${normaliseName(sentence)} `.includes(` ${needle} `)) return sentence;
  }
  return null;
}
