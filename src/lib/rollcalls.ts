/**
 * The House's own record of who voted for what.
 *
 * The queue is built from reporting, and reporting almost never names a member
 * of Congress for a procedural vote. A representative whose only documented act
 * is a Yea on a munitions transfer never enters the ledger, which is a strange
 * hole on a site about the people who decide on force.
 *
 * The clerk publishes every roll call as XML, no key and no scraping. This
 * module reads them: which bill, which day, and how each member voted. The vote
 * is the primary record, so a charge built from it does not need a news article
 * to stand on — it needs the roll call number and a date.
 *
 * Deliberately narrow: only the House, only the recent rolls, and only the bills
 * whose subject is arms, Israel, UNRWA or defence. This is a source, not a
 * crawler.
 */

export interface HouseVote {
  /** Bioguide ID: the join to a full name. */
  id: string;
  /** Surname as the clerk prints it, with a state suffix when names collide. */
  name: string;
  party: string;
  state: string;
  vote: string;
}

export interface RollCall {
  congress: number;
  session: number;
  roll: number;
  /** ISO date of the vote. */
  date: string;
  /** Bill number as the clerk prints it, e.g. "H R 1234". */
  bill: string;
  question: string;
  result: string;
  title: string;
  url: string;
  votes: HouseVote[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const rollUrl = (year: number, roll: number): string =>
  `https://clerk.house.gov/EVS/${year}/roll${String(roll).padStart(3, "0")}.xml`;

const tag = (xml: string, name: string): string => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
};

/** "25-Mar-2026" -> "2026-03-25". */
function isoDate(raw: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function parseRoll(xml: string, year: number, roll: number): RollCall | null {
  if (!xml.includes("<rollcall-vote>")) return null;
  const date = isoDate(tag(xml, "action-date"));
  if (!date) return null;

  const votes: HouseVote[] = [];
  // The clerk varies the attribute order between files, so read the whole tag
  // and pull the three attributes out of it rather than matching them in place.
  const pattern =
    /<recorded-vote>\s*<legislator\s([^>]*)>([^<]*)<\/legislator>\s*<vote>([^<]*)<\/vote>/g;
  for (const m of xml.matchAll(pattern)) {
    const attrs = m[1];
    votes.push({
      id: /name-id="([^"]*)"/.exec(attrs)?.[1] ?? "",
      party: /party="([^"]*)"/.exec(attrs)?.[1] ?? "",
      state: /state="([^"]*)"/.exec(attrs)?.[1] ?? "",
      name: m[2].trim(),
      vote: m[3].trim(),
    });
  }

  return {
    congress: Number(tag(xml, "congress") || 0),
    session: Number(tag(xml, "session") || 0),
    roll,
    date,
    bill: tag(xml, "legis-num"),
    question: tag(xml, "vote-question"),
    result: tag(xml, "vote-result"),
    title: tag(xml, "vote-desc"),
    url: rollUrl(year, roll),
    votes,
  };
}

async function fetchRoll(year: number, roll: number): Promise<RollCall | null> {
  try {
    const res = await fetch(rollUrl(year, roll), { redirect: "follow" });
    if (!res.ok) return null;
    const xml = await res.text();
    if (xml.length < 500) return null;
    return parseRoll(xml, year, roll);
  } catch {
    return null;
  }
}

/**
 * The highest roll number the year has reached.
 *
 * The clerk has no index a Worker can read — the votes page is rendered in the
 * browser — so this walks the range instead. Ten requests, not three hundred.
 */
async function latestRollNumber(year: number): Promise<number> {
  let low = 1;
  let high = 800;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const roll = await fetchRoll(year, mid);
    if (roll) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** The most recent rolls, newest first. */
export async function recentRolls(limit = 18): Promise<RollCall[]> {
  const year = new Date().getUTCFullYear();
  const latest = await latestRollNumber(year);
  const rolls: RollCall[] = [];
  for (let n = latest; n >= 1 && rolls.length < limit; n -= 1) {
    const roll = await fetchRoll(year, n);
    if (roll) rolls.push(roll);
  }
  return rolls;
}

export const billLabel = (bill: string): string =>
  bill.replace(/^H R\s+/i, "H.R. ").replace(/^H J RES\s+/i, "H.J.Res. ").replace(/^H RES\s+/i, "H.Res. ");

export const prettyDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${names[m - 1]} ${y}`;
};
