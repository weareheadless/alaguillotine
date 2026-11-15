/**
 * Jurisdiction, written down.
 *
 * The register can now answer "what did this member trade" and "what committee
 * do they sit on". The step between those two answers is not data: it is the
 * claim that a committee has jurisdiction over a kind of business. That claim is
 * editorial, so it is written here, once, in plain words, and printed next to
 * every lead it produces.
 *
 * The lists are deliberately short and specific. They are not a sector
 * classification and make no claim to completeness: they name companies whose
 * business is obviously before the committee, so that a match is a question
 * worth asking rather than an inference stretched to fit. A missed trade costs
 * nothing; a wrong one costs the site its credibility.
 */

/** The only body with a jurisdiction map so far. */
export const HOUSE_BODY = "US-House";

export interface Jurisdiction {
  /** Which body's committee this is. Rules never cross bodies. */
  body: string;
  committee: string;
  /** What the committee actually oversees, in words a reader can check. */
  oversees: string;
  /** Distinctive name fragments. Short tokens are matched on word boundaries. */
  names: string[];
}

export const JURISDICTIONS: Jurisdiction[] = [
  {
    body: HOUSE_BODY,
    committee: "AS00",
    oversees: "defence procurement and the armed forces",
    names: [
      "Lockheed",
      "Raytheon",
      "RTX",
      "Northrop",
      "General Dynamics",
      "L3Harris",
      "Huntington Ingalls",
      "Leidos",
      "Booz Allen",
      "Palantir",
      "Kratos",
      "AeroVironment",
      "General Atomics",
      "CACI",
      "Boeing",
    ],
  },
  {
    body: HOUSE_BODY,
    committee: "BA00",
    oversees: "banks, securities, insurance and digital assets",
    names: [
      "JPMorgan",
      "Goldman Sachs",
      "Morgan Stanley",
      "Bank of America",
      "Citigroup",
      "Wells Fargo",
      "BlackRock",
      "Blackstone",
      "KKR",
      "Apollo Global",
      "Coinbase",
      "Charles Schwab",
      "American Express",
      "Berkshire Hathaway",
      "Capital One",
      "State Street",
      "Northern Trust",
      "Mastercard",
      "Visa",
    ],
  },
  {
    body: HOUSE_BODY,
    committee: "IF00",
    oversees: "energy, health care, telecommunications and consumer products",
    names: [
      "Exxon",
      "Chevron",
      "ConocoPhillips",
      "Occidental",
      "Marathon Petroleum",
      "Pfizer",
      "Merck",
      "Johnson & Johnson",
      "Eli Lilly",
      "AbbVie",
      "Amgen",
      "Gilead",
      "UnitedHealth",
      "CVS",
      "Cigna",
      "Humana",
      "AT&T",
      "Verizon",
      "Comcast",
      "T-Mobile",
      "Alphabet",
      "Meta Platforms",
      "Microsoft",
      "Amazon",
    ],
  },
  {
    body: HOUSE_BODY,
    committee: "II00",
    oversees: "public lands, mining, and oil and gas leasing",
    names: [
      "Freeport-McMoRan",
      "Newmont",
      "Barrick",
      "Halliburton",
      "Schlumberger",
      "SLB",
      "Baker Hughes",
      "Williams Companies",
      "Kinder Morgan",
      "Peabody Energy",
      "Arch Resources",
      "Devon Energy",
      "Diamondback Energy",
    ],
  },
  {
    body: HOUSE_BODY,
    committee: "AG00",
    oversees: "farm policy, food and agricultural inputs",
    names: [
      "Archer-Daniels-Midland",
      "ADM",
      "Tyson Foods",
      "Bunge",
      "Deere",
      "Bayer",
      "CF Industries",
      "Nutrien",
      "Smithfield",
      "Corteva",
    ],
  },
  {
    body: HOUSE_BODY,
    committee: "PW00",
    oversees: "aviation, shipping, rail and public works",
    names: [
      "Delta Air Lines",
      "United Airlines",
      "American Airlines",
      "Southwest Airlines",
      "FedEx",
      "United Parcel Service",
      "UPS",
      "Union Pacific",
      "CSX",
      "Norfolk Southern",
      "Caterpillar",
      "Granite Construction",
      "MasTec",
    ],
  },
  {
    body: HOUSE_BODY,
    committee: "FA00",
    oversees: "foreign policy and arms sales",
    names: ["Lockheed", "Raytheon", "RTX", "Northrop", "General Dynamics", "Boeing", "L3Harris"],
  },
  {
    body: HOUSE_BODY,
    committee: "HM00",
    oversees: "homeland security and border contracting",
    names: ["Palantir", "Leidos", "Booz Allen", "CACI", "General Dynamics", "L3Harris", "Unisys", "Maxar"],
  },
  {
    body: HOUSE_BODY,
    committee: "SY00",
    oversees: "science, space and technology",
    names: [
      "SpaceX",
      "Blue Origin",
      "Lockheed",
      "Northrop",
      "L3Harris",
      "Maxar",
      "Rocket Lab",
      "Planet Labs",
      "Palantir",
      "Nvidia",
      "Intel",
      "Micron",
      "Applied Materials",
    ],
  },
  {
    body: HOUSE_BODY,
    committee: "WM00",
    oversees: "tax, trade, health programmes and Social Security",
    names: ["UnitedHealth", "Humana", "CVS", "Cigna", "Pfizer", "Merck", "AbbVie", "Amgen", "HCA"],
  },
  {
    body: HOUSE_BODY,
    committee: "JU00",
    oversees: "antitrust, immigration and intellectual property",
    names: ["Alphabet", "Meta Platforms", "Apple", "Microsoft", "Amazon", "Nvidia", "Live Nation"],
  },
  {
    body: HOUSE_BODY,
    committee: "GO00",
    oversees: "federal contracting and government operations",
    names: ["Palantir", "Leidos", "Booz Allen", "CACI", "General Dynamics", "Lockheed", "Boeing", "Deloitte", "Accenture"],
  },
];

const BY_BODY = new Map(
  JURISDICTIONS.map((entry) => [`${entry.body}|${entry.committee}`, entry] as const),
);

export function jurisdictionFor(code: string, body = HOUSE_BODY): Jurisdiction | undefined {
  return BY_BODY.get(`${body}|${code}`);
}

export function jurisdictionsFor(body: string): Jurisdiction[] {
  return JURISDICTIONS.filter((entry) => entry.body === body);
}

function normalise(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** Does this asset name match a company the committee plainly oversees? */
export function matches(asset: string, ticker: string, jurisdiction: Jurisdiction): boolean {
  const haystack = normalise(`${asset} ${ticker}`);
  return jurisdiction.names.some((name) => {
    const needle = normalise(name).trim();
    if (!needle) return false;
    // Word boundaries on both sides: "Visa" must not match "Visas", and "RTX"
    // must not match inside another word.
    return new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(haystack);
  });
}
