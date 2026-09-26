/**
 * race-share.ts — pure, dependency-free builders for the /race/<id> permalink.
 *
 * Two consumers:
 *   - the server route (generateMetadata + the OG image route) builds page
 *     metadata from a RaceResult;
 *   - the client share control builds a ready-to-post, reply-first payload.
 *
 * Nothing here touches the network, the database, or `window`, so it can be
 * unit-tested directly and imported from both server and client components.
 */

export interface RaceShareResultLike {
  message: { author_name: string; score: number; text: string };
  candidate: string;
}

export interface ShareInput {
  id: string;
  authorName: string;
  score: number;
  candidate: string;
  messageText: string;
}

export interface RaceResultMetadata {
  title: string;
  description: string;
  url: string;
  imagePath: string;
  imageAlt: string;
  noindex: boolean;
}

export interface SharePayload {
  /** Distribution mode: post as a reply to an existing thread (reply-first). */
  kind: "reply-first";
  /** Ready-to-post body text, with the permalink appended. */
  text: string;
  /** Absolute permalink for the result card. */
  url: string;
  /** Absolute URL of the per-result OpenGraph card image. */
  imageUrl: string;
  /** Alt text to accompany the image. */
  imageAlt: string;
}

export const DEFAULT_BASE_URL = "https://www.fuckyouelon.net";
const MAX_DESCRIPTION = 200;
const MAX_BODY = 220;

/** Canonical site path of the per-result OpenGraph card image. */
export function raceResultImagePath(id: string): string {
  return `/race/${encodeURIComponent(id)}/opengraph-image`;
}

export function raceResultUrl(id: string, baseUrl: string = DEFAULT_BASE_URL): string {
  return `${trimBase(baseUrl)}/race/${encodeURIComponent(id)}`;
}

export function raceResultImageUrl(id: string, baseUrl: string = DEFAULT_BASE_URL): string {
  return `${trimBase(baseUrl)}${raceResultImagePath(id)}`;
}

function trimBase(baseUrl: string): string {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function clampScore(score: number): string {
  const n = Number.isFinite(score) ? Math.floor(score) : 0;
  return `${Math.max(0, Math.min(5, n))}/5`;
}

function collapseWhitespace(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  const clean = collapseWhitespace(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Page metadata for a permalink. Returns a noindex not-found shape when the
 * result does not exist so the page and its image can render a safe fallback.
 */
export function buildRaceResultMetadata(
  result: RaceShareResultLike | null | undefined,
  id: string,
  baseUrl: string = DEFAULT_BASE_URL,
): RaceResultMetadata {
  if (!result) {
    return {
      title: "Result not found — FUCKYOUELON",
      description: "That result is not on the board.",
      url: raceResultUrl(id, baseUrl),
      imagePath: raceResultImagePath(id),
      imageAlt: "FUCKYOUELON race result",
      noindex: true,
    };
  }
  const authorName = result.message.author_name || "Anonymous Spite";
  const candidate = result.candidate || "no candidate";
  return {
    title: `${authorName} scored ${clampScore(result.message.score)} on ${candidate} — FUCKYOUELON`,
    description: truncate(result.message.text, MAX_DESCRIPTION) || "A verdict from the guillotine.",
    url: raceResultUrl(id, baseUrl),
    imagePath: raceResultImagePath(id),
    imageAlt: `${authorName} scored ${clampScore(result.message.score)} on ${candidate}`,
    noindex: false,
  };
}

/**
 * Build a ready-to-post, reply-first distribution payload. The caller decides
 * how to emit it (Web Share sheet, clipboard, bot queue); this function never
 * sends anything.
 */
export function buildSharePayload(
  input: ShareInput,
  opts: { baseUrl?: string; replyContext?: string } = {},
): SharePayload {
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
  const authorName = input.authorName || "Anonymous Spite";
  const candidate = input.candidate || "no candidate";
  const url = raceResultUrl(input.id, baseUrl);
  const imageUrl = raceResultImageUrl(input.id, baseUrl);
  const imageAlt = `${authorName} scored ${clampScore(input.score)} on ${candidate}`;

  const excerpt = truncate(input.messageText, MAX_BODY);
  const lead = opts.replyContext ? `${collapseWhitespace(opts.replyContext)} ` : "";
  const text = `${lead}${authorName} scored ${clampScore(input.score)} on ${candidate}: “${excerpt}” — swing back: ${url}`;

  return { kind: "reply-first", text, url, imageUrl, imageAlt };
}
