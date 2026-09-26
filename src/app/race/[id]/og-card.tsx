import { ImageResponse } from "next/og";
import { getRaceResult } from "../../../lib/race";

export const ogSize = { width: 1200, height: 630 } as const;
export const ogContentType = "image/png";
export const ogRuntime = "nodejs" as const;
export const ogAlt = "FUCKYOUELON race result";

const CANVAS = "#0B0B0C";
const SHEET = "#F5F5F5";
const MUTED = "#9AA0A6";
const RULE = "#2A2A2E";
const CRIMSON = "#FF2E4C";
const NEON = "#39FF6A";

/**
 * Render the 1200x630 OpenGraph card for one race result. Reads the same
 * getRaceResult() the permalink page uses, so an unknown/unlisted id yields a
 * neutral fallback card instead of throwing. Shared by the opengraph-image and
 * twitter-image file conventions.
 */
export function renderRaceResultImage(id: string): ImageResponse {
  const result = getRaceResult(id);
  const author = result?.message.author_name || "Anonymous Spite";
  const score = result?.message.score ?? 0;
  const candidate = result?.candidate || "the board";
  const rawText = result?.message.text || "No verdict on this board.";
  const text = rawText.length > 240 ? `${rawText.slice(0, 239).trimEnd()}…` : rawText;
  const sideColor = result?.side === "b" ? NEON : CRIMSON;
  const sideLabel = result ? (result.side === "b" ? "BOARD B" : "BOARD A") : "NOT FOUND";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CANVAS,
          color: SHEET,
          padding: "56px 64px",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <span>// race result</span>
          <span style={{ color: sideColor }}>{sideLabel}</span>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            fontSize: 42,
            lineHeight: 1.3,
            marginTop: 24,
          }}
        >
          {`“${text}”`}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            borderTop: `2px solid ${RULE}`,
            paddingTop: 24,
            color: MUTED,
          }}
        >
          <span style={{ color: SHEET, fontWeight: 700 }}>{author}</span>
          <span style={{ color: sideColor, marginLeft: 16, fontWeight: 700 }}>
            scored {score}/5
          </span>
          <span style={{ marginLeft: 16 }}>on {candidate}</span>
        </div>
      </div>
    ),
    { width: ogSize.width, height: ogSize.height },
  );
}
