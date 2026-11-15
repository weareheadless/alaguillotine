/**
 * Finding a passage in a document, and refusing a passage that is furniture.
 *
 * The re-grounding pass stored quotes with whitespace collapsed, so a sentence
 * that spanned a line break no longer existed in the stored text: 125 of 284
 * matched claims failed a literal check while being substantially real. The fix
 * is not a looser check, it is to store the bytes that are actually there.
 *
 * `exactSpan` normalises whitespace while keeping a map back to every original
 * character, so a match found in normalised space becomes a byte range in the
 * document. What gets stored is that range, and the check that follows is a
 * plain substring test.
 */

const FURNITURE = [
  /^Credit:/i,
  /^Published\b/i,
  /^Updated\b/i,
  /^By\s+\p{Lu}/u,
  /^Log in\b/i,
  /^Sign in\b/i,
  /^Subscribe\b/i,
  /^Share\b/i,
  /^Advertisement\b/i,
  /^Menu\b/i,
  /^Home\b/i,
  /^Search\b/i,
  /^Skip to\b/i,
  /\bmin read\b/i,
  /\b\d+\s*min read\b/i,
  /^Cookie\b/i,
];

/** A page byline, a reading-time stamp, a login prompt: not the sentence. */
export function isFurniture(quote: string): boolean {
  const clean = quote.replace(/\s+/g, " ").trim();
  if (clean.length < 40) return true;
  return FURNITURE.some((pattern) => pattern.test(clean));
}

interface Normalised {
  text: string;
  /** For each character of `text`, its index in the source. */
  map: number[];
}

function normalise(source: string): Normalised {
  let text = "";
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const isSpace = /\s/.test(char) || char === "\u00a0";
    if (isSpace) {
      if (lastWasSpace) continue;
      text += " ";
      map.push(i);
      lastWasSpace = true;
    } else {
      text += char;
      map.push(i);
      lastWasSpace = false;
    }
  }
  return { text, map };
}

export interface Span {
  start: number;
  end: number;
  exact: string;
  /** True when the stored quote already existed verbatim. */
  verbatim: boolean;
}

export function exactSpan(document: string, quote: string): Span | null {
  const needle = quote.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
  if (needle.length < 20) return null;

  const literalAt = document.indexOf(needle);
  if (literalAt >= 0) {
    // The stored quote must be the bytes in the document, not the caller's
    // copy. A description with doubled whitespace normalises to a needle that
    // still matches, and returning `quote` here stored the doubled space and
    // made the claim fail its own substring check.
    return {
      start: literalAt,
      end: literalAt + needle.length,
      exact: document.slice(literalAt, literalAt + needle.length),
      verbatim: true,
    };
  }

  const haystack = normalise(document);
  const at = haystack.text.indexOf(needle);
  if (at < 0) return null;

  const start = haystack.map[at];
  const last = haystack.map[at + needle.length - 1];
  if (start === undefined || last === undefined) return null;
  return {
    start,
    end: last + 1,
    exact: document.slice(start, last + 1),
    verbatim: false,
  };
}
