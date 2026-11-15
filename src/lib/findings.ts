/**
 * Findings, discovered from the reporting rather than from a roster.
 *
 * The old register started with a population of officeholders and read the
 * documents those institutions publish about themselves. That can only produce
 * compliance: a declaration, a vote, a filing. This module starts with the
 * finding: an investigative or court report that says a named person did
 * something, with the sentence that says it.
 *
 * The name is an output. Nothing has to be in a universe first.
 *
 * Precision rules, because a wrong name is worse than a missing one:
 *   - the person must be the subject of a passive finding ("X was convicted"),
 *     the subject of a plea ("X pleaded guilty"), or the object of an agent's
 *     finding ("a jury convicted X", "prosecutors charged X");
 *   - a judge who "sentenced" someone is not the convict, so bare
 *     subject/verb frames are rejected;
 *   - organisations, places, titles and negations ("never charged") are out;
 *   - a surname is only expanded to a full name the article itself uses, so the
 *     name is still an output of the document;
 *   - the quote is the sentence itself, stored against the article text, and
 *     verified again before it reaches a page.
 */

export interface Outlet {
  key: string;
  name: string;
  base: string;
}

export const OUTLETS: Outlet[] = [
  { key: "propublica", name: "ProPublica", base: "https://www.propublica.org" },
  { key: "icij", name: "ICIJ", base: "https://www.icij.org" },
  { key: "reveal", name: "Reveal", base: "https://revealnews.org" },
  { key: "intercept", name: "The Intercept", base: "https://theintercept.com" },
  { key: "motherjones", name: "Mother Jones", base: "https://www.motherjones.com" },
  { key: "correctiv", name: "Correctiv", base: "https://correctiv.org" },
  { key: "rollingstone", name: "Rolling Stone", base: "https://www.rollingstone.com" },
  { key: "premiumtimes", name: "Premium Times", base: "https://www.premiumtimesng.com" },
  { key: "balkaninsight", name: "Balkan Insight", base: "https://balkaninsight.com" },
  { key: "pcij", name: "PCIJ", base: "https://pcij.org" },
  { key: "plazapublica", name: "Plaza Pública", base: "https://www.plazapublica.com.gt" },
  { key: "armando", name: "Armando.info", base: "https://www.armando.info" },
  { key: "insightcrime", name: "InSight Crime", base: "https://www.insightcrime.org" },
  { key: "injusticewatch", name: "Injustice Watch", base: "https://www.injusticewatch.org" },
  { key: "trace", name: "The Trace", base: "https://www.thetrace.org" },
  { key: "thecity", name: "The City", base: "https://www.thecity.nyc" },
  { key: "typeinvestigations", name: "Type Investigations", base: "https://www.typeinvestigations.org" },
  { key: "bylinetimes", name: "Byline Times", base: "https://www.bylinetimes.com" },
  { key: "hkfp", name: "Hong Kong Free Press", base: "https://www.hongkongfp.com" },
];

export type FindingKind = "found" | "alleged" | "admitted";

export interface Finding {
  name: string;
  verb: string;
  finding: FindingKind;
  offense: string;
  category: string;
  act: string;
  quote: string;
  fromTitle?: boolean;
}

const SUFFIXES = new Set(["Jr", "Jr.", "Sr", "Sr.", "II", "III", "IV"]);

const TITLES = new Set([
  "Former", "Late", "Judge", "Justice", "Mr", "Mr.", "Mrs", "Mrs.", "Ms",
  "Ms.", "Dr", "Dr.", "President", "Prime", "Minister", "Mayor", "Senator",
  "Representative", "Governor", "Gov", "Gov.", "Sheriff", "Chief", "Officer",
  "Detective", "Attorney", "Lawyer", "CEO", "Executive", "Businessman",
  "Businesswoman", "Professor", "Reverend", "Rev", "Rev.", "General",
  "Colonel", "Captain", "Sergeant", "Sen", "Sen.", "Rep", "Rep.", "MP", "MEP",
  "Speaker", "Atty", "Atty.", "Sec", "Sec.", "Supt", "Lt", "Lt.", "Capt",
  "Capt.", "Sgt", "Sgt.", "Cmdr", "Cmdr.", "Adm", "Adm.",
]);

/** Words that are never a person's name on their own. */
const NOT_A_PERSON = new Set([
  "The", "This", "That", "These", "Those", "A", "An",
  "When", "While", "After", "Before", "Since", "Because", "Although", "Though",
  "However", "But", "And", "If", "As", "At", "In", "On", "For", "With", "By",
  "From", "During", "Despite", "Meanwhile", "Later", "Now", "Then", "There",
  "Here", "It", "He", "She", "They", "We", "You", "I", "His", "Her", "Their",
  "Our", "Its", "What", "Who", "Why", "How", "Where", "Which", "One", "Two",
  "Three", "First", "Last", "Next", "Earlier", "Previously", "Recently",
  "Investigators", "Prosecutors", "Officials", "Authorities", "Agents",
  "Officers", "Attorneys", "Lawyers", "Democrats", "Republicans", "ProPublica",
  "ICIJ", "Correctiv", "Bellingcat", "OCCRP", "Reuters", "Bloomberg", "Guardian",
  "Times", "Post", "Journal", "News", "Media", "Press", "Report", "Reports",
  "Complete", "Coverage", "Trials", "Read", "More", "Watch", "Listen",
  "Subscribe", "Sign", "Share", "Advertisement", "Skip", "Menu", "Search",
  "Home", "Latest", "Newsletter", "Seeing", "Making", "Taking", "Giving",
  "Getting", "Going", "Coming", "Looking", "Using", "Calling", "Keeping",
  "Letting", "Putting", "Running", "Saying", "Telling", "Thinking", "Trying",
  "Working", "Writing", "Reading", "Speaking", "Building", "Buying", "Selling",
  "Paying", "Playing", "Showing", "Growing", "Holding", "Standing", "Sitting",
  "Waiting", "Walking", "Wondering", "Asking", "Answering", "According",
  "Including", "Following", "Facing", "Seeking", "Leading", "Leaving", "Rising",
  "Falling", "Winning", "Losing", "Killing", "Dying", "Hiding", "Fleeing",
  "Returning", "Arriving", "Dissent", "Project", "Credit", "Investigative",
  "Office", "VP", "CEO", "CFO", "COO", "CTO", "Chairman", "Chairwoman",
  "Chicago", "Houston", "Dallas", "Miami", "Boston", "Seattle", "Denver",
  "Phoenix", "Atlanta", "Detroit", "Philadelphia", "Pittsburgh", "Cleveland",
  "Baltimore", "Newark", "Oakland", "Portland", "Austin", "Nashville",
  "Memphis", "Louisville", "Richmond", "Charlotte", "Raleigh", "Orlando",
  "Tampa", "Jacksonville", "Texas", "Florida", "California", "Arizona",
  "Nevada", "Ohio", "Georgia", "Michigan", "Virginia", "Maryland",
  "Massachusetts", "Pennsylvania", "Illinois", "Wisconsin", "Minnesota",
  "Colorado", "Oregon", "Alabama", "Mississippi", "Louisiana", "Kentucky",
  "Tennessee", "Indiana", "Iowa", "Utah", "Oklahoma", "Nebraska", "Kansas",
  "Facebook", "Twitter", "WhatsApp", "Instagram", "YouTube", "LinkedIn",
  "Telegram", "Email", "Share", "Print", "Comment", "Comments",
  "America", "American", "Americans", "Africa", "African", "Asia", "Asian",
  "Europe", "European", "Britain", "British", "England", "English", "Scotland",
  "Scottish", "Wales", "Welsh", "Ireland", "Irish",
  "China", "Chinese", "Russia", "Russian", "Ukraine", "Ukrainian", "Israel",
  "Israeli", "Iran", "Iranian", "Iraq", "Iraqi", "Syria", "Syrian", "Turkey",
  "Turkish", "India", "Indian", "Pakistan", "Pakistani", "Nigeria", "Nigerian",
  "Kenya", "Kenyan", "Mexico", "Mexican", "Brazil", "Brazilian", "France",
  "French", "Germany", "German", "Spain", "Spanish", "Italy", "Italian",
  "Canada", "Canadian", "Australia", "Australian", "Japan", "Japanese",
  "Korea", "Korean", "Colombia", "Colombian", "Venezuela", "Venezuelan",
  "Peru", "Bolivia", "Chile", "Argentina", "Egypt", "Egyptian", "Libya",
  "Sudan", "Congo", "Rwanda", "Uganda", "Zimbabwe", "Philippines", "Filipino",
  "Indonesia", "Malaysia", "Thailand", "Vietnam", "Afghanistan", "Yemen",
  "Lebanon", "Jordan", "Qatar", "Saudi", "Morocco", "Algeria", "Tunisia",
  "Greece", "Greek", "Poland", "Polish", "Hungary", "Romania", "Bulgaria",
  "Serbia", "Croatia", "Bosnia", "Kosovo", "Albania", "Georgia", "Armenia",
  "Azerbaijan", "Kazakhstan", "Moldova", "Belarus", "Latvia", "Lithuania",
  "Estonia", "Finland", "Sweden", "Norway", "Denmark", "Netherlands",
  "Belgium", "Switzerland", "Austria", "Portugal", "London", "Paris", "Berlin",
  "Madrid", "Rome", "Athens", "Moscow", "Kyiv", "Beijing", "Tokyo", "Delhi",
  "Mumbai", "Lagos", "Nairobi", "Cairo", "Istanbul", "Jerusalem",
  "Washington", "Congress", "Senate", "Parliament", "Court", "Department",
  "Treasury", "Police", "County", "City", "State", "Federal", "Company",
  "Corporation", "Bank", "Group", "Trust", "Fund", "Capital", "Partners",
  "Holdings", "University", "College", "Hospital", "Church", "Institute",
  "Foundation", "Association", "Agency", "Administration", "Authority",
  "Commission", "Committee", "Council", "Bureau", "Ministry", "Party", "Union",
  "Army", "Navy", "Guard", "International", "National", "Global", "Central",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December", "President", "Minister",
  "Senator", "Representative", "Governor", "Mayor", "Judge", "Justice", "Chief",
  "Officer", "Detective", "Attorney", "Sheriff", "Marshal", "Doctor",
  "Professor", "Reverend", "Inc", "LLC", "LP", "LLP", "Corp", "Co",
]);

/** Two-word names that are places or institutions. */
const NOT_A_PERSON_PHRASE = new Set([
  "White House", "New York", "Los Angeles", "San Francisco", "San Diego",
  "San Antonio", "Santa Fe", "Las Vegas", "United States", "United Nations",
  "Supreme Court", "District Court", "Circuit Court", "Federal Court",
  "Justice Department", "State Department", "Attorney General",
  "Prime Minister", "Vice President", "New Jersey", "New Mexico",
  "New Hampshire", "New Orleans", "North Carolina", "South Carolina",
  "North Dakota", "South Dakota", "West Virginia", "Rhode Island",
  "Hong Kong", "South Africa", "Saudi Arabia", "Sri Lanka", "El Salvador",
  "Costa Rica", "Puerto Rico", "St Louis", "St Petersburg", "Wall Street",
  "Silicon Valley", "Kansas City", "Oklahoma City", "Salt Lake", "New Delhi",
  "Sierra Leone", "Burkina Faso", "Ivory Coast", "Papua New Guinea",
]);

/** A name that starts with a place particle is a place, not a person. */
const PLACE_PREFIX = new Set([
  "Port", "Fort", "Mount", "Lake", "Saint", "St", "St.", "San", "Santa", "Los",
  "Las", "El", "La", "Ciudad", "Sao", "São", "Rio", "Buenos", "Mexico",
  "Panama", "Guatemala", "Cape", "Isle", "New", "North", "South", "East",
  "West", "Upper", "Lower", "Great", "Little", "Grand", "Middle", "Northern",
  "Southern", "Eastern", "Western",
]);

const ORG_AFTER = /^(?:LP|LLC|LLP|Inc|Inc\.|Corp|Corp\.|Corporation|Company|Co|Co\.|Bank|Group|Partners|Holdings|Capital|Fund|Trust|Association|Agency|Department|Ministry|Commission|Committee|Court|University|Police|County|City|State|District|Authority|Bureau|Office|Pty|GmbH|SA|AG|BV|NV)$/;

const TOKEN = "[A-Z][\\p{L}'’.-]*";
const NAME = `(${TOKEN}(?:\\s+${TOKEN}){1,2})`;

/** What can sit between the name and the verb. */
const BEFORE_VERB =
  "(?:\\s*,\\s*\\d{1,3}\\s*,?\\s*" +
  "|\\s*,\\s*(?:who|which)\\s+(?:later\\s+|also\\s+|subsequently\\s+|previously\\s+|has\\s+|had\\s+)*" +
  "|\\s*,\\s*(?:a|an|the|of)\\s+[^,]{2,40},\\s*" +
  "|\\s+of\\s+[^,]{2,40}\\s+" +
  "|\\s+)";

const AUX = "(?:was|were|has been|have been|had been|is|are|been)";
const FIND_VERB = "(convicted|sentenced|charged|indicted|found guilty)";

const PASSIVE = new RegExp(
  NAME +
    BEFORE_VERB +
    AUX +
    "\\s+(?:arrested and |arrested, then |also )?" +
    FIND_VERB +
    "\\b",
  "gu",
);

const PLEA = new RegExp(
  NAME +
    BEFORE_VERB +
    "(?:pleaded|pleads|plead|has pleaded|had pleaded|is pleading)\\s+guilty\\b",
  "gu",
);

const AGENT =
  "(?:(?:A|An|The|Federal|State|County|City|Local|US|U\\.S\\.)?\\s*" +
  "(?:jury|Jury|jurors|Jurors|judge|Judge|justice|Justice|court|Court|" +
  "magistrate|Magistrate|panel|prosecutors?|Prosecutors?|district attorney|" +
  "District attorney|attorney general|Attorney General|authorities|" +
  "Authorities|officials|Officials|investigators|Investigators))";

const OBJECT = new RegExp(
  AGENT + "[^.]{0,80}?\\b(?:convicted|sentenced|charged|indicted)\\s+" + NAME,
  "gu",
);

const OBJECT_GUILTY = new RegExp(
  AGENT + "[^.]{0,80}?\\bfound\\s+" + NAME + "\\s+guilty\\b",
  "gu",
);

const TITLE_FRAME = new RegExp(
  NAME +
    "\\s+(?:is |was |has been |were )?" +
    "(convicted|sentenced|charged|indicted|pleaded guilty|pleads guilty|found guilty)" +
    "\\b",
  "gu",
);

const SURNAME = `(${TOKEN})`;
const SURNAME_PASSIVE = new RegExp(
  SURNAME + BEFORE_VERB + AUX + "\\s+(?:arrested and |also )?" + FIND_VERB + "\\b",
  "gu",
);
const SURNAME_PLEA = new RegExp(
  SURNAME + BEFORE_VERB + "(?:pleaded|pleads|plead|has pleaded|had pleaded)\\s+guilty\\b",
  "gu",
);
const SURNAME_OBJECT = new RegExp(
  AGENT + "[^.]{0,80}?\\b(?:convicted|sentenced|charged|indicted)\\s+" + SURNAME,
  "gu",
);

const FULL_NAME = new RegExp(`${TOKEN}(?:\\s+${TOKEN}){1,2}`, "gu");

function cleanSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTitles(value: string): string {
  const parts = value.split(/\s+/);
  while (parts.length > 1 && (TITLES.has(parts[0]) || /^Ex[-–]/i.test(parts[0]))) parts.shift();
  while (parts.length > 2 && SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

function nextWord(sentence: string, end: number): string {
  const match = /^\s+(\S+)/.exec(sentence.slice(end));
  return match ? match[1] : "";
}

function nameWordsOk(words: string[]): boolean {
  if (words.length < 2 || words.length > 3) return false;
  if (words.some((word) => !/^[A-Z][\p{L}'’.-]*$/u.test(word))) return false;
  if (words.some((word) => word.length < 2 && !/^[A-Z]\.$/.test(word))) return false;
  if (words.some((word) => /\d/.test(word))) return false;
  if (words.some((word) => /\.$/.test(word) && !/^[A-Z]\.$/.test(word))) return false;
  if (words.some((word) => /['’]$/.test(word))) return false;
  if (words.some((word) => /['’]s\b/i.test(word))) return false;
  if (words.some((word) => NOT_A_PERSON.has(word))) return false;
  if (PLACE_PREFIX.has(words[0])) return false;
  if (NOT_A_PERSON_PHRASE.has(words.slice(0, 2).join(" "))) return false;
  if (words.every((word) => word === word.toUpperCase())) return false;
  return true;
}

function looksLikePerson(name: string, sentence: string, end: number): boolean {
  if (name.length < 5 || name.length > 48) return false;
  if (/['’]s\b/.test(sentence.slice(end, end + 3))) return false;
  if (ORG_AFTER.test(nextWord(sentence, end).replace(/[,.;:].*$/, ""))) return false;
  return nameWordsOk(name.split(/\s+/));
}

/**
 * Full names the article itself uses, with an unambiguous surname map. A
 * surname only expands when exactly one full name in the article ends with it.
 */
function articleNames(article: string): Map<string, string> {
  const bySurname = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const match of article.matchAll(FULL_NAME)) {
    const name = stripTitles(match[0]);
    if (!nameWordsOk(name.split(/\s+/))) continue;
    const surname = name.split(/\s+/).pop()!;
    const previous = bySurname.get(surname);
    if (previous && previous !== name) ambiguous.add(surname);
    else bySurname.set(surname, name);
  }
  for (const surname of ambiguous) bySurname.delete(surname);
  return bySurname;
}

/** A 19th-century case inside a 2026 article is history, not a current finding. */
function oldCase(sentence: string): boolean {
  const years = [...sentence.matchAll(/\b(1[89]\d{2}|20\d{2})\b/g)].map((m) => Number(m[1]));
  return years.length > 0 && Math.max(...years) < 1990;
}

function isNegated(sentence: string, at: number, end: number): boolean {
  const before = sentence.slice(Math.max(0, at - 70), at);
  if (
    /(?:\bnever\b|\bnot\b|\bno\b|\bwithout\b|\bdenies?\b|\bdenied\b|\bacquitted\b|\bcleared\b|\bdropped\b|\boverturned\b|\bvacated\b|\breversed\b|\bif\b|\bwhether\b)[^.;]{0,45}$/i.test(
      before,
    )
  ) {
    return true;
  }
  const after = sentence.slice(end, end + 60);
  return /\b(?:acquitted|cleared|dropped|dismissed|overturned|vacated|reversed|retrial)\b/i.test(
    after,
  );
}

const CRIMES = [
  "crimes against humanity", "ethnic cleansing", "forced displacement",
  "arbitrary detention", "obstruction of justice", "witness tampering",
  "money laundering", "wire fraud", "mail fraud", "bank fraud",
  "securities fraud", "tax fraud", "tax evasion", "insider trading",
  "market manipulation", "accounting fraud", "mortgage fraud",
  "health care fraud", "insurance fraud", "child sexual abuse",
  "child pornography", "sexual assault", "sexual abuse", "domestic violence",
  "human trafficking", "sex trafficking", "drug trafficking",
  "arms trafficking", "sanctions evasion", "illicit enrichment",
  "abuse of office", "abuse of power", "conflict of interest",
  "war crimes", "genocide", "torture", "deportation", "persecution",
  "bribery", "bribes", "accepting bribes", "graft", "corruption", "embezzlement", "extortion",
  "kickbacks", "nepotism", "racketeering", "conspiracy", "perjury",
  "espionage", "treason", "insurrection", "sedition", "kidnapping",
  "murder", "manslaughter", "homicide", "assault", "rape", "molestation",
  "false reporting", "theft", "robbery", "burglary", "fraud", "forgery",
  "counterfeiting", "smuggling", "detention", "spying", "stalking",
  "cyberstalking", "organ trafficking", "child abuse", "attempting a coup",
  "coup", "treason",
];

/** The crime the sentence names, if it names one. */
function crimeIn(sentence: string): string {
  const lower = sentence.toLowerCase();
  let best = "";
  for (const crime of CRIMES) {
    if (crime.length > best.length && new RegExp(`\\b${crime}\\b`, "i").test(lower)) {
      best = crime;
    }
  }
  return best;
}

function offenseOf(sentence: string, from: number, allowTo: boolean): string {
  const tail = sentence.slice(from);
  const preps = allowTo
    ? "of|for|with|on|over|to|in connection with"
    : "of|for|with|on|over|in connection with";
  const direct = new RegExp(`^\\s*(?:${preps})\\s+(.{3,110})`, "i").exec(tail);
  const indirect = /\bfor\s+(.{3,90})/i.exec(tail);
  let captured = direct ? direct[1] : indirect ? indirect[1] : "";
  // "pleaded guilty to Thursday to three felonies": skip the day and retry.
  captured = captured.replace(
    /^(?:on\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:to\s+)?/i,
    "",
  );
  captured = captured.split(/\s+(?:after|when|while|according to|as part of)\b/i)[0];
  captured = captured.replace(/[.;:,]+\s*$/, "").trim();
  // "convicted by the tribunal for the former Yugoslavia" is an institution,
  // not an offence.
  if (/^the former\b/i.test(captured) || /\bTribunal\b/i.test(captured)) captured = "";

  if (/^(?:the\s+)?(?:former|government|company|state|city|county|department|ministry|court)\b/i.test(captured)) {
    captured = "";
  }

  const crime = crimeIn(sentence);
  let value = "";
  if (captured && crimeIn(captured)) value = captured;
  else if (crime) value = crime;
  else if (
    captured &&
    captured.split(/\s+/).length <= 4 &&
    !/\b(?:was|were|is|are|has|had|will|would)\b/i.test(captured)
  ) {
    value = captured;
  } else {
    value = "";
  }
  value = value.split(/[—–]/)[0];
  value = value.split(/[,;]/)[0];
  value = value.split(
    /\s+(?:and|but)\s+(?:was|were|is|are|has|had|will|would|faces?|received?|got)\b/i,
  )[0];
  value = value.replace(/\s+in\s+\d{4}\b.*$/, "");
  value = value.replace(
    /\s+on\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b.*$/i,
    "",
  );
  if (/^(?:his|her|their|its)\s+/i.test(value)) {
    const crime = crimeIn(value);
    if (crime) value = crime;
  }
  return value.replace(/\s+/g, " ").trim().slice(0, 90);
}

function categoryOf(offense: string, sentence: string): string {
  const text = `${offense} ${sentence}`;
  if (/\blaur?nder|\bproceeds of crime\b/i.test(text)) return "money-laundering";
  if (/\bbrib|\bcorrupt|\bkickback|\bembezzl|\bextort|\bnepotism|\babuse of (?:power|office)|\bconflict of interest\b/i.test(text)) {
    return "corruption";
  }
  if (/\bfraud|\bponzi|\bscam|\bforg|\bcounterfeit|\bsecurities|\binsider|\btax evasion|\bevasion\b/i.test(text)) {
    return "fraud";
  }
  if (/\bsexual|\brape|\bassault|\bchild (?:abuse|porn)|\bmolest|\bgroom/i.test(text)) {
    return "sexual-violence";
  }
  if (/\bmurder|\bhomicide|\bkill|\bmanslaughter|\bweapon|\bgun|\bshoot/i.test(text)) {
    return "violence";
  }
  if (/\bdrug|\bnarcotic|\bcocaine|\bheroin|\bfentanyl|\bmethamphetamine/i.test(text)) {
    return "drugs";
  }
  if (/\btheft|\bsteal|\brobber|\bburglar|\blarceny|\bmisappropriat/i.test(text)) {
    return "theft";
  }
  if (/\bperjur|\bobstruct|\bwitness tamper|\bevidence/i.test(text)) return "obstruction";
  if (/\bsanction|\bembargo/i.test(text)) return "sanctions";
  if (/\btraffick/i.test(text)) return "trafficking";
  return "other";
}

function labelFor(verb: string): { label: string; finding: FindingKind; prep: string } {
  const lower = verb.toLowerCase();
  if (lower.startsWith("plea")) {
    return { label: "Pleaded guilty", finding: "admitted", prep: "to" };
  }
  if (lower.includes("guilty")) return { label: "Found guilty", finding: "found", prep: "of" };
  if (lower.startsWith("convict")) return { label: "Convicted", finding: "found", prep: "of" };
  if (lower.startsWith("sentenc")) return { label: "Sentenced", finding: "found", prep: "for" };
  if (lower.startsWith("indic")) return { label: "Indicted", finding: "alleged", prep: "on charges of" };
  return { label: "Charged", finding: "alleged", prep: "with" };
}

interface Hit {
  name: string;
  verb: string;
  at: number;
  end: number;
  from: number;
  fromTitle?: boolean;
}

export function extractFindings(article: string, title = ""): Finding[] {
  const sentences = article
    .split(/(?<=[.!?])\s+(?=[A-Z“"'(])/u)
    .map(cleanSentence)
    .filter((sentence) => sentence.length >= 30 && sentence.length <= 700);

  const known = articleNames(`${title}\n${article}`);
  const findings: Finding[] = [];
  const best = new Map<string, Finding>();
  const rank: Record<FindingKind, number> = { found: 3, admitted: 2, alleged: 1 };

  const add = (hit: Hit, sentence: string) => {
    let name = stripTitles(hit.name);
    // "Mr Terry" is a surname with an honorific, not a two-part name: expand it
    // only when the article itself gives the full name.
    if (!name.includes(" ")) {
      const full = known.get(name);
      if (!full) return;
      name = full;
    }
    if (!nameWordsOk(name.split(/\s+/))) return;
    if (!looksLikePerson(name, sentence, hit.end)) return;

    // "the adviser to Trump, who was convicted" or "the killing of ... Mabasa
    // was sentenced": a name that is the object of a preposition is not the
    // subject of the clause that follows it.
    const before = sentence.slice(Math.max(0, hit.at - 16), hit.at);
    if (/(?:^|\s)(?:to|of|for|by|with|from|against|including|like|than)\s+$/i.test(before)) {
      return;
    }
    if (/["”’]\s*$/u.test(before)) return;

    if (isNegated(sentence, hit.at, hit.end)) return;
    if (oldCase(sentence)) return;

    const offense = offenseOf(sentence, hit.from, hit.verb.startsWith("plea"));
    const { label, finding, prep } = labelFor(hit.verb);
    let act = offense ? `${label} ${prep} ${offense}` : label;
    if (!offense && hit.verb.startsWith("sentenc")) {
      const consequence = /\bto\s+([^,;.]{3,70})/i.exec(sentence.slice(hit.from));
      if (consequence) act = `${label} to ${consequence[1].trim()}`;
    }

    const row: Finding = {
      name,
      verb: hit.verb.toLowerCase(),
      finding,
      offense,
      category: categoryOf(offense, sentence),
      act: act.charAt(0).toUpperCase() + act.slice(1),
      quote: sentence.slice(0, 500),
      fromTitle: hit.fromTitle || undefined,
    };

    const key = name.toLowerCase();
    const previous = best.get(key);
    if (!previous) best.set(key, row);
    else if (previous.fromTitle && !row.fromTitle) best.set(key, row);
    else if (Boolean(previous.fromTitle) === Boolean(row.fromTitle) && rank[row.finding] > rank[previous.finding]) {
      best.set(key, row);
    }
  };

  const collect = (sentence: string) => {
    const hits: Hit[] = [];

    for (const match of sentence.matchAll(PASSIVE)) {
      hits.push({
        name: match[1],
        verb: match[2],
        at: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        from: (match.index ?? 0) + match[0].length,
      });
    }
    for (const match of sentence.matchAll(PLEA)) {
      hits.push({
        name: match[1],
        verb: "pleaded guilty",
        at: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        from: (match.index ?? 0) + match[0].length,
      });
    }
    for (const match of sentence.matchAll(OBJECT)) {
      const nameAt = (match.index ?? 0) + match[0].lastIndexOf(match[1]);
      const verbMatch = /\b(convicted|sentenced|charged|indicted)\b/.exec(match[0]);
      hits.push({
        name: match[1],
        verb: verbMatch ? verbMatch[1] : "charged",
        at: match.index ?? 0,
        end: nameAt + match[1].length,
        from: nameAt + match[1].length,
      });
    }
    for (const match of sentence.matchAll(OBJECT_GUILTY)) {
      const nameAt = (match.index ?? 0) + match[0].lastIndexOf(match[1]);
      hits.push({
        name: match[1],
        verb: "found guilty",
        at: match.index ?? 0,
        end: nameAt + match[1].length,
        from: nameAt + match[1].length,
      });
    }

    // Surnames alone, expanded only to a full name used by the same article.
    if (known.size) {
      for (const match of sentence.matchAll(SURNAME_PASSIVE)) {
        const full = known.get(match[1]);
        if (!full) continue;
        hits.push({
          name: full,
          verb: match[2],
          at: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          from: (match.index ?? 0) + match[0].length,
        });
      }
      for (const match of sentence.matchAll(SURNAME_PLEA)) {
        const full = known.get(match[1]);
        if (!full) continue;
        hits.push({
          name: full,
          verb: "pleaded guilty",
          at: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          from: (match.index ?? 0) + match[0].length,
        });
      }
      for (const match of sentence.matchAll(SURNAME_OBJECT)) {
        const full = known.get(match[1]);
        if (!full) continue;
        const nameAt = (match.index ?? 0) + match[0].lastIndexOf(match[1]);
        const verbMatch = /\b(convicted|sentenced|charged|indicted)\b/.exec(match[0]);
        hits.push({
          name: full,
          verb: verbMatch ? verbMatch[1] : "charged",
          at: match.index ?? 0,
          end: nameAt + match[1].length,
          from: nameAt + match[1].length,
        });
      }
    }

    for (const hit of hits) add(hit, sentence);
  };

  for (const sentence of sentences) collect(sentence);

  if (title) {
    for (const match of title.matchAll(TITLE_FRAME)) {
      add(
        {
          name: match[1],
          verb: match[2],
          at: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          from: (match.index ?? 0) + match[0].length,
          fromTitle: true,
        },
        title,
      );
    }
  }

  for (const row of best.values()) findings.push(row);
  return findings;
}

/** HTML to text, keeping paragraph breaks. */
export function articleText(html: string): string {
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
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&rsquo;|&#8217;|&#x2019;/g, "’")
    .replace(/&lsquo;|&#8216;|&#x2018;/g, "‘")
    .replace(/&ldquo;|&#8220;|&#x201C;/g, "“")
    .replace(/&rdquo;|&#8221;|&#x201D;/g, "”")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const QUERIES = [
  "convicted",
  "sentenced",
  "charged",
  "pleaded guilty",
  "bribery",
  "embezzlement",
  "money laundering",
  "indicted",
];

export function searchUrl(
  outlet: Outlet,
  query: string,
  perPage: number,
  after = "2020-01-01T00:00:00",
): string {
  const params = new URLSearchParams({
    search: query,
    per_page: String(perPage),
    after,
    orderby: "date",
    order: "desc",
    _fields: "date,link,title,content",
  });
  return `${outlet.base}/wp-json/wp/v2/posts?${params.toString()}`;
}

export interface Post {
  date: string;
  link: string;
  title: string;
  content: string;
}
