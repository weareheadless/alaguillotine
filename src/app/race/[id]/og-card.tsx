import type { ImageResponse } from "next/og";
import { getRaceResult } from "../../../lib/race";
import {
  OG_ALT,
  OG_CONTENT_TYPE,
  OG_HEIGHT,
  OG_WIDTH,
  renderRaceResultCard,
} from "../../../lib/race-og";

export const ogSize = { width: OG_WIDTH, height: OG_HEIGHT } as const;
export const ogContentType = OG_CONTENT_TYPE;
export const ogRuntime = "nodejs" as const;
export const ogAlt = OG_ALT;

/**
 * Render the OpenGraph card for one race result. Reads the same getRaceResult()
 * the permalink page uses, so an unknown/unlisted id yields a neutral fallback
 * card instead of throwing. Shared by the opengraph-image and twitter-image
 * file conventions.
 */
export function renderRaceResultImage(id: string): ImageResponse {
  const result = getRaceResult(id);
  return renderRaceResultCard({
    found: Boolean(result),
    authorName: result?.message.author_name || "Anonymous Spite",
    score: result?.message.score ?? 0,
    candidate: result?.candidate || "the board",
    messageText: result?.message.text || "No verdict on this board.",
    side: result?.side ?? null,
  });
}
