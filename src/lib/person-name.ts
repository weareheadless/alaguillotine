/**
 * One person, one name.
 *
 * The wire writes the same person many ways: "Jeff Yass" for "Jeffrey Yass",
 * "Donald J. Trump" for "Donald Trump", "Sultan Ahmed Al Jaber" for "Sultan Al
 * Jaber", "Johnny Lehi Jr." for "Johnny Lehi". Matching on substrings pulled
 * different people together ("John Smith" and "Johnny Smithson"), and matching
 * on the exact string split one person in two. This is the one comparison the
 * site uses: surname first, then a first name that is equal, a known
 * diminutive, or a prefix of four letters or more.
 *
 * Nothing here guesses that two different full names are one person just
 * because they share a surname. An alias is still recorded when a variant is
 * seen, so the record shows which spelling was matched.
 */

export interface ParsedName {
  /** Folded first name, accents and punctuation removed. */
  first: string;
  /** Folded middle name(s), possibly empty. */
  middle: string;
  /** Folded surname, including any particle ("al jaber", "van der berg"). */
  last: string;
  /** Folded suffix ("jr", "iii"), empty when there is none. */
  suffix: string;
}

const SUFFIXES = new Set([
  "jr", "sr", "ii", "iii", "iv", "v", "phd", "md", "esq", "kc", "cbe", "obe", "mbe",
]);

/** Surname particles stay with the surname: "Al Jaber" is one surname. */
const PARTICLES = new Set([
  "al", "bin", "da", "das", "de", "del", "der", "di", "dos", "el", "ibn", "la",
  "le", "ten", "ter", "van", "von",
]);

/**
 * Diminutives that share no prefix with the name they shorten. Both sides are
 * folded already; a group means "these are the same first name".
 */
const NICKNAME_GROUPS: string[][] = [
  ["robert", "bob", "bobby", "rob", "robbie"],
  ["william", "bill", "billy", "will", "willie"],
  ["james", "jim", "jimmy", "jamie"],
  ["michael", "mike", "mikey", "mick"],
  ["richard", "dick", "rick", "rich", "richie"],
  ["thomas", "tom", "tommy"],
  ["daniel", "dan", "danny"],
  ["david", "dave", "davy"],
  ["joseph", "joe", "joey"],
  ["anthony", "tony"],
  ["christopher", "chris"],
  ["nicholas", "nick", "nicky"],
  ["peter", "pete"],
  ["steven", "stephen", "steve"],
  ["benjamin", "ben", "benny"],
  ["samuel", "sam", "sammy"],
  ["alexander", "alex", "alec"],
  ["albert", "al", "bert"],
  ["matthew", "matt"],
  ["gregory", "greg"],
  ["jeffrey", "jeff"],
  ["edward", "ed", "eddie", "ted", "ned"],
  ["margaret", "maggie", "meg", "peggy"],
  ["elizabeth", "liz", "beth", "betty", "eliza"],
  ["catherine", "katherine", "kate", "kathy", "katie"],
  ["patricia", "pat", "patty"],
  ["jennifer", "jen", "jenny"],
  ["andrew", "andy", "drew"],
  ["lawrence", "larry"],
  ["gerald", "jerry"],
  ["kenneth", "ken", "kenny"],
  ["ronald", "ron", "ronnie"],
  ["donald", "don", "donnie"],
  ["timothy", "tim", "timmy"],
  ["philip", "phillip", "phil"],
  ["charles", "charlie", "chuck"],
  ["frederick", "fred", "freddie"],
  ["douglas", "doug"],
  ["raymond", "ray"],
  ["eugene", "gene"],
  ["francis", "frank", "frankie"],
  ["vincent", "vince"],
  ["nathaniel", "nate", "nathan"],
  ["terrence", "terry"],
  ["terence", "terry"],
];

/** Lowercase, unaccented, punctuation folded. Comparison only. */
export function foldName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/[.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePersonName(raw: string): ParsedName | null {
  const words = foldName(raw).split(" ").filter(Boolean);
  if (words.length < 2) return null;

  let suffix = "";
  if (words.length > 2 && SUFFIXES.has(words[words.length - 1])) {
    suffix = words.pop() as string;
  }
  if (words.length < 2) return null;

  // The surname runs from the last non-particle word to the end.
  let lastStart = words.length - 1;
  while (lastStart > 1 && PARTICLES.has(words[lastStart - 1])) lastStart -= 1;

  return {
    first: words[0],
    middle: words.slice(1, lastStart).join(" "),
    last: words.slice(lastStart).join(" "),
    suffix,
  };
}

/**
 * A comparison key: folded first, middle and last, with the suffix dropped.
 * The middle name stays, because "David J. Taylor" and "David Taylor" are not
 * the same key — dropping it silently pooled two public figures' scores.
 */
export function nameKey(raw: string): string {
  const parsed = parsePersonName(raw);
  if (!parsed) return foldName(raw);
  return `${parsed.first} ${parsed.middle} ${parsed.last}`.replace(/\s+/g, " ").trim();
}

function sameFirst(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  for (const group of NICKNAME_GROUPS) {
    if (group.includes(a) && group.includes(b)) return true;
  }
  // "jeff" and "jeffrey": a real short form, not a shared first syllable.
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

function compatibleMiddle(a: ParsedName, b: ParsedName): boolean {
  if (!a.middle && !b.middle) return true;
  if (a.middle && b.middle) return a.middle[0] === b.middle[0];
  // One side has a middle name and the other does not. A full middle name is
  // usually the same person filed in more detail ("Sultan Ahmed Al Jaber"). A
  // bare initial is a different person far more often ("David J. Taylor" the
  // congressman, "David Taylor" the MP), and merging two public figures is the
  // worse error.
  const present = a.middle || b.middle;
  return present.length > 1;
}

function compatibleSuffix(a: ParsedName, b: ParsedName): boolean {
  if (!a.suffix || !b.suffix) return true;
  return a.suffix === b.suffix;
}

function sameBase(A: ParsedName, B: ParsedName): boolean {
  return (
    A.last === B.last &&
    compatibleSuffix(A, B) &&
    sameFirst(A.first, B.first)
  );
}

/** Are these two spellings the same person? */
export function samePerson(a: string, b: string): boolean {
  const A = parsePersonName(a);
  const B = parsePersonName(b);
  if (!A || !B) return foldName(a) === foldName(b);
  if (!sameBase(A, B)) return false;
  return compatibleMiddle(A, B);
}

/**
 * A new spelling that adds a middle name to a name already on the record:
 * "Donald J. Trump" for "Donald Trump". The reverse is not an expansion —
 * dropping a middle initial may be a different person — so this is used only
 * when the observed name is the longer one.
 */
export function sameNameExpanded(observed: string, known: string): boolean {
  const O = parsePersonName(observed);
  const K = parsePersonName(known);
  if (!O || !K) return false;
  if (!sameBase(O, K)) return false;
  if (K.middle || !O.middle) return false;
  return true;
}

/** The surname alone, folded, for narrowing a candidate list. */
export function surnameOf(raw: string): string {
  return parsePersonName(raw)?.last ?? foldName(raw).split(" ").pop() ?? "";
}
