import { actKey } from "./ledger-write";
import { evidenceFor } from "./evidence";
import { slugify } from "./slug";

/**
 * Sanctions, read as a register.
 *
 * The wire-and-judge path discovers people by reading the news and asking a
 * model who it noticed. That is the expensive way to learn what a sanctions
 * list already publishes: a name, a date, a stated reason and a reference
 * number, in a document designed to be parsed. The UN consolidated list alone
 * names seven hundred people across the DRC, Sudan, Al-Qaida, the Taliban and
 * the rest.
 *
 * So this is the plain path. No search, no model, no interpretation: the
 * Security Council's own words, the day they were listed, and the list as the
 * citation. If the model is down, this still works — which is the point.
 */

export type SanctionDb = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      run: () => Promise<unknown>;
      all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
    };
  };
};

export const UN_LIST_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml";

export interface SanctionEntry {
  name: string;
  reference: string;
  listType: string;
  listedOn: string;
  comments: string;
  nationality: string;
}

const tag = (block: string, name: string): string => {
  const m = regexFor(name).exec(block);
  return m ? decode(m[1].trim()) : "";
};

const cache = new Map<string, RegExp>();
const regexFor = (name: string): RegExp => {
  let re = cache.get(name);
  if (!re) {
    re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i");
    cache.set(name, re);
  }
  return re;
};

const decode = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    // NATIONALITY and some comments are wrapped in <VALUE> elements; the text
    // is the value, not the markup.
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();

/** The UN prints names in capitals; the site does not shout. */
const titleCase = (s: string): string =>
  s
    .toLowerCase()
    .split(/([\s'-])/)
    .map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join("");

/** Sanctions programmes that document a war rather than a financial crime. */
const WAR_PROGRAMMES = [
  "drc",
  "sudan",
  "south sudan",
  "somalia",
  "libya",
  "mali",
  "central african",
  "yemen",
  "haiti",
  "al-qaida",
  "isil",
  "taliban",
  "iraq",
  "syria",
  "afghanistan",
  "eritrea",
  "guinea-bissau",
  "south sudan",
  "burundi",
  "rwanda",
];

const categoryFor = (listType: string): string =>
  WAR_PROGRAMMES.some((p) => listType.toLowerCase().includes(p)) ? "war" : "impunity";

/** The listing's stated reason, without the form fields around it. */
const reasonOf = (comments: string): string =>
  comments
    .replace(/^Gender:\s*\w+\.\s*/i, "")
    .replace(/INTERPOL-UN Security Council Special Notice:\s*\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

export function parseUnList(xml: string): SanctionEntry[] {
  const entries: SanctionEntry[] = [];
  const blocks = xml.match(/<INDIVIDUAL>[\s\S]*?<\/INDIVIDUAL>/gi) ?? [];
  for (const block of blocks) {
    const first = tag(block, "FIRST_NAME");
    const second = tag(block, "SECOND_NAME");
    const third = tag(block, "THIRD_NAME");
    const name = [first, second, third].filter(Boolean).join(" ");
    const listedOn = tag(block, "LISTED_ON");
    const reference = tag(block, "REFERENCE_NUMBER");
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(listedOn)) continue;
    entries.push({
      name: titleCase(name),
      reference,
      listType: tag(block, "UN_LIST_TYPE"),
      listedOn,
      comments: reasonOf(tag(block, "COMMENTS1")),
      nationality: tag(block, "NATIONALITY"),
    });
  }
  return entries;
}

export interface SanctionRun {
  listed: number;
  filed: number;
  promoted: number;
  names: string[];
  errors?: string[];
}

/**
 * Fetch the list, file the recent listings, and put the names on the block.
 *
 * `months` bounds what is filed: the archive wants the record, but a listing
 * from 2012 is not this week's charge, and the window decides what scores.
 * Names listed inside the evidence window are also entered into the queue —
 * a Security Council determination is a receipt, which is exactly what the
 * line requires.
 */
export async function ingestSanctions(
  db: SanctionDb,
  options: { months?: number } = {},
): Promise<SanctionRun> {
  const months = Math.max(1, Math.min(36, options.months ?? 24));
  const since = new Date(Date.now() - months * 30 * 86_400_000).toISOString().slice(0, 10);

  const res = await fetch(UN_LIST_URL, {
    headers: { accept: "application/xml" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`UN list ${res.status}`);
  const entries = parseUnList(await res.text()).filter((e) => e.listedOn >= since);

  const windowCut = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  let filed = 0;
  let promoted = 0;
  const names: string[] = [];
  const errors: string[] = [];

  for (const entry of entries) {
    const place = entry.nationality || entry.listType;
    // The date is written the way the rest of the ledger writes dates — "14
    // July 2026" — so the scorer reads it as a day rather than falling back to
    // mid-year. An ISO stamp here would cost the listing a third of its weight.
    const listed = new Date(`${entry.listedOn}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    // A listing whose only comment was a notice link still has to read as a
    // sentence. This is what the register states, not an allegation invented
    // to fill the space.
    const reason =
      entry.comments.length >= 20
        ? entry.comments.slice(0, 180)
        : `Listed under the ${entry.listType || "UN"} sanctions regime`;
    const act = `${reason} (UN Security Council listing, ${listed})`.slice(0, 240);
    const source = entry.reference
      ? `${UN_LIST_URL}#${entry.reference}`
      : UN_LIST_URL;
    try {
      await db
        .prepare(
          `INSERT INTO ledger_entries
             (id, person, role, act, place, year, category, confidence, sources, case_id, created_at, attribution, review_status, date_precision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unknown')
           ON CONFLICT(id) DO UPDATE SET
             act = excluded.act, confidence = excluded.confidence, sources = excluded.sources`,
        )
        .bind(
          actKey(entry.name, act),
          entry.name,
          `UN-listed ${entry.listType}`.trim(),
          act,
          place,
          Number(entry.listedOn.slice(0, 4)),
          categoryFor(entry.listType),
          88,
          JSON.stringify([source]),
          `un:${entry.reference || slugify(entry.name)}`,
          new Date().toISOString(),
          1,
        )
        .run();
      filed += 1;
      names.push(entry.name);
    } catch (error) {
      console.error(
        "sanctions_filed_failed",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // A listing inside the window is also an appointment for the blade: the
    // determination is on record, so the name can stand.
    if (entry.listedOn >= windowCut) {
      try {
        const now = new Date().toISOString();
        const result = await db
          .prepare(
            `INSERT INTO queue_people
               (id, name, slug, role, country, reason, score, mentions, rank, prev_rank,
                added_at, last_seen_at, dropped_at, items, source, source_url, record_bonus)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 999, NULL, ?, ?, NULL, '[]', 'UN sanctions', ?, 0)
             ON CONFLICT(slug) DO NOTHING`,
          )
          .bind(
            crypto.randomUUID(),
            entry.name,
            slugify(entry.name),
            `UN-listed ${entry.listType}`.trim(),
            place,
            act,
            // Scored on the listing itself, so the name never appears at zero
            // waiting for the next pass — a zero reads as an acquittal.
            evidenceFor([
              {
                act,
                year: Number(entry.listedOn.slice(0, 4)),
                category: categoryFor(entry.listType),
                confidence: 88,
                attribution: 1,
                grade: "B",
              },
            ]).score,
            now,
            now,
            source,
          )
          .run();
        if ((result as { meta?: { changes?: number } })?.meta?.changes) promoted += 1;
      } catch (error) {
        // A queue row is not worth failing the ingest over, but it is worth
        // saying out loud: a silent catch here is how the line stayed empty
        // while the ledger filled.
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  return {
    listed: entries.length,
    filed,
    promoted,
    names: [...new Set(names)].slice(0, 20),
    errors: errors.slice(0, 5),
  };
}
