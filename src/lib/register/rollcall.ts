/**
 * The roll call, parsed.
 *
 * The Clerk publishes one XML file per vote. It is the cleanest document class
 * the register has: an issuer, a number, a date, and a list of legislators with
 * an id and a vote. No model, no paraphrase, no ambiguity — which is exactly
 * why it must not be read as prose.
 *
 * The parsing here is deliberately dumb and total: regular expressions over a
 * known shape, and a refusal to return a vote for a member who is not in the
 * file. A missing member is a fact about the record ("not in this roll call"),
 * not an excuse to guess one.
 */

export interface RollCallMeta {
  congress: number;
  session: string;
  chamber: string;
  roll: number;
  /** H R 2670, H RES 773 — the Clerk's own spelling. */
  legislation: string;
  question: string;
  /** The vote type: YEA-AND-NAY, RECORDED VOTE, 2/3 YEA-AND-NAY. */
  kind: string;
  result: string;
  /** ISO date, from the Clerk's `20-Apr-2024`. */
  actionDate: string;
  description: string;
}

export interface RollCallVote {
  nameId: string;
  sortName: string;
  party: string;
  state: string;
  vote: string;
}

function tag(xml: string, name: string): string {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  if (!match) return "";
  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** `20-Apr-2024` → `2024-04-20`. Empty when it is not a date we understand. */
export function isoDate(value: string): string {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  if (!match) return "";
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return "";
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

const VOTE_ELEMENT =
  /<legislator\s([^>]*)>([\s\S]*?)<\/legislator>\s*<vote>([\s\S]*?)<\/vote>/g;

function attribute(block: string, name: string): string {
  const match = new RegExp(`${name}="([^"]*)"`, "i").exec(block);
  return match ? match[1] : "";
}

export function parseRollCall(xml: string): {
  meta: RollCallMeta | null;
  votes: RollCallVote[];
  /** The exact fragments the votes were read from, keyed by bioguide id. */
  fragments: Map<string, string>;
} {
  if (!/<rollcall-vote/i.test(xml)) return { meta: null, votes: [], fragments: new Map() };

  const roll = Number(tag(xml, "rollcall-num")) || 0;
  if (!roll) return { meta: null, votes: [], fragments: new Map() };

  const meta: RollCallMeta = {
    congress: Number(tag(xml, "congress")) || 0,
    session: tag(xml, "session"),
    chamber: tag(xml, "chamber"),
    roll,
    legislation: tag(xml, "legis-num"),
    question: tag(xml, "vote-question"),
    kind: tag(xml, "vote-type"),
    result: tag(xml, "vote-result"),
    actionDate: isoDate(tag(xml, "action-date")),
    description: tag(xml, "vote-desc"),
  };

  const votes: RollCallVote[] = [];
  const fragments = new Map<string, string>();
  let match: RegExpExecArray | null;
  VOTE_ELEMENT.lastIndex = 0;
  while ((match = VOTE_ELEMENT.exec(xml))) {
    const [, attrs, inner, cast] = match;
    const nameId = attribute(attrs, "name-id").trim();
    const vote = cast.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!nameId || !vote) continue;
    votes.push({
      nameId,
      sortName: attribute(attrs, "sort-field").trim() || inner.replace(/<[^>]+>/g, "").trim(),
      party: attribute(attrs, "party").trim(),
      state: attribute(attrs, "state").trim(),
      vote,
    });
    // The exact substring of the file, not a reconstruction of it. Rebuilding
    // the tag from parsed attributes produced quotes that read correctly and
    // failed verification against the stored document — which is the whole
    // point of a quote. Verbatim means byte-for-byte.
    fragments.set(nameId, match[0]);
  }

  return { meta, votes, fragments };
}

/** Yea/Aye and Nay/No are the same answer under two spellings. */
export function sameVote(claimed: string, recorded: string): boolean {
  const norm = (value: string) => {
    const v = value.toLowerCase().replace(/[^a-z ]/g, "").trim();
    if (v === "aye" || v === "yea") return "yea";
    if (v === "no" || v === "nay") return "nay";
    return v;
  };
  return norm(claimed) === norm(recorded);
}

/** What the record establishes about a claimed vote. */
export type VoteFinding =
  | { kind: "agrees"; vote: string }
  | { kind: "conflicts"; vote: string }
  | { kind: "abstained"; vote: string }
  | { kind: "present"; vote: string }
  | { kind: "absent"; vote: string };

export function compareVote(claimed: string, recorded: string | undefined): VoteFinding {
  if (!recorded) return { kind: "absent", vote: "" };
  if (sameVote(claimed, recorded)) return { kind: "agrees", vote: recorded };
  if (/^not voting$/i.test(recorded)) return { kind: "abstained", vote: recorded };
  if (/^present$/i.test(recorded)) return { kind: "present", vote: recorded };
  return { kind: "conflicts", vote: recorded };
}
