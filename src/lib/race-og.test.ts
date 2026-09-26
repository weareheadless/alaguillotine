/**
 * Rasterization tests for the pure OG card renderer. These actually run
 * next/og (satori + resvg) and assert a real PNG comes back, so a card that
 * would 5xx at request time fails the suite instead of shipping.
 * Run via `npm test`. No DB, no network, no Next server.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OG_CONTENT_TYPE, OG_HEIGHT, OG_WIDTH, renderRaceResultCard, toRaceCardData } from "./race-og";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function renderBytes(data: Parameters<typeof renderRaceResultCard>[0]): Promise<Buffer> {
  const image = renderRaceResultCard(data);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), OG_CONTENT_TYPE);
  const buf = Buffer.from(await image.arrayBuffer());
  assert.ok(buf.slice(0, 8).equals(PNG_SIGNATURE), "output must be a PNG");
  return buf;
}

const realResult = {
  found: true,
  authorName: "John Smith",
  score: 4,
  candidate: "Musk",
  messageText: "A well-aimed line about the guillotine",
  side: "a" as const,
};

test("card size is the standard 1200x630 OG size", () => {
  assert.equal(OG_WIDTH, 1200);
  assert.equal(OG_HEIGHT, 630);
});

test("renders a real race result to a non-trivial PNG card", async () => {
  const buf = await renderBytes(realResult);
  assert.ok(buf.length > 2000, `expected a real image, got ${buf.length} bytes`);
});

test("renders a fallback card for a missing result", async () => {
  const buf = await renderBytes({
    found: false,
    authorName: "Anonymous Spite",
    score: 0,
    candidate: "the board",
    messageText: "",
    side: null,
  });
  assert.ok(buf.length > 2000);
});

test("card output is data-driven (different results differ)", async () => {
  const a = await renderBytes(realResult);
  const b = await renderBytes({ ...realResult, authorName: "Someone Else", score: 1, side: "b" });
  assert.ok(!a.equals(b), "cards for different results must not be byte-identical");
});

// ─── Result-to-card mapping (the seam the route uses) ──────────────────────

const raceRow = {
  message: { author_name: "John Smith", score: 4, text: "A well-aimed line" },
  candidate: "Musk",
  side: "a" as const,
};

test("maps a found result to card data with its candidate and side", () => {
  const data = toRaceCardData(raceRow);
  assert.equal(data.found, true);
  assert.equal(data.authorName, "John Smith");
  assert.equal(data.score, 4);
  assert.equal(data.candidate, "Musk");
  assert.equal(data.messageText, "A well-aimed line");
  assert.equal(data.side, "a");
});

test("maps a board-b result to side b", () => {
  assert.equal(toRaceCardData({ ...raceRow, side: "b" }).side, "b");
});

test("maps a missing result to the not-found fallback card data", () => {
  const data = toRaceCardData(null);
  assert.equal(data.found, false);
  assert.equal(data.side, null);
  assert.equal(data.authorName, "Anonymous Spite");
  assert.equal(data.candidate, "the board");
  assert.equal(data.messageText, "");
});

test("mapping supplies neutral fallbacks for blank fields", () => {
  const data = toRaceCardData({ message: { author_name: "", score: 0, text: "" }, candidate: "", side: "a" });
  assert.equal(data.found, true);
  assert.equal(data.authorName, "Anonymous Spite");
  assert.equal(data.candidate, "the board");
  assert.equal(data.messageText, "No verdict on this board.");
});

test("the mapped card of a real result rasterizes", async () => {
  const buf = await renderBytes(toRaceCardData(raceRow));
  assert.ok(buf.length > 2000);
});

