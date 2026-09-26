import { ImageResponse } from "next/og";

/**
 * Pure OpenGraph card renderer for a race result. Takes plain data (no DB, no
 * Next request context) so it can be unit-tested by rasterizing directly.
 * The /race/[id] route wraps this with the getRaceResult() lookup.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "FUCKYOUELON race result";

const CANVAS = "#0B0B0C";
const SHEET = "#F5F5F5";
const MUTED = "#9AA0A6";
const RULE = "#2A2A2E";
const CRIMSON = "#FF2E4C";
const NEON = "#39FF6A";

export interface RaceCardData {
  found: boolean;
  authorName: string;
  score: number;
  candidate: string;
  messageText: string;
  side: "a" | "b" | null;
}

export function renderRaceResultCard(data: RaceCardData): ImageResponse {
  const rawText = data.messageText || "No verdict on this board.";
  const text = rawText.length > 240 ? `${rawText.slice(0, 239).trimEnd()}…` : rawText;
  const sideColor = data.side === "b" ? NEON : CRIMSON;
  const sideLabel = data.found ? (data.side === "b" ? "BOARD B" : "BOARD A") : "NOT FOUND";

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
          <span style={{ color: SHEET, fontWeight: 700 }}>{data.authorName || "Anonymous Spite"}</span>
          <span style={{ color: sideColor, marginLeft: 16, fontWeight: 700 }}>scored {data.score}/5</span>
          <span style={{ marginLeft: 16 }}>on {data.candidate || "the board"}</span>
        </div>
      </div>
    ),
    { width: OG_WIDTH, height: OG_HEIGHT },
  );
}
