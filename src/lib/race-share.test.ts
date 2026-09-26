/**
 * Unit tests for the pure permalink/share builders. Run with `npm test`
 * (compiles with tsc CLI flags into .test-build, then `node --test`).
 * No database, no network, no browser — these exercise the metadata and
 * payload logic that the /race/[id] page and the share control depend on.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BASE_URL,
  buildRaceResultMetadata,
  buildSharePayload,
  raceResultImagePath,
  raceResultImageUrl,
  raceResultUrl,
} from "./race-share";

const result = {
  message: { author_name: "John Smith", score: 4, text: "  A   well-aimed   line  " },
  candidate: "Musk",
};

test("raceResultImagePath is the canonical per-result OG image path", () => {
  assert.equal(raceResultImagePath("msg_123"), "/race/msg_123/opengraph-image");
  assert.equal(raceResultImagePath("a/b"), "/race/a%2Fb/opengraph-image");
});

test("raceResultUrl joins base and id without double slashes", () => {
  assert.equal(raceResultUrl("msg_123"), `${DEFAULT_BASE_URL}/race/msg_123`);
  assert.equal(raceResultUrl("msg_123", "http://localhost:3999/"), "http://localhost:3999/race/msg_123");
});

test("raceResultImageUrl embeds the image path under a custom base", () => {
  assert.equal(raceResultImageUrl("msg_9", "http://x.test/"), "http://x.test/race/msg_9/opengraph-image");
});

test("metadata carries per-result title, description and image", () => {
  const meta = buildRaceResultMetadata(result, "msg_123");
  assert.equal(meta.noindex, false);
  assert.match(meta.title, /John Smith/);
  assert.match(meta.title, /4\/5/);
  assert.match(meta.title, /Musk/);
  assert.equal(meta.description, "A well-aimed line");
  assert.equal(meta.imagePath, "/race/msg_123/opengraph-image");
  assert.match(meta.imageAlt, /John Smith scored 4\/5 on Musk/);
  assert.equal(meta.url, `${DEFAULT_BASE_URL}/race/msg_123`);
});

test("metadata for a missing result is a safe noindex fallback", () => {
  const meta = buildRaceResultMetadata(null, "missing");
  assert.equal(meta.noindex, true);
  assert.match(meta.title, /not found/i);
  assert.equal(meta.imagePath, "/race/missing/opengraph-image");
});

test("long descriptions are truncated to the 200 char budget", () => {
  const long = "x".repeat(500);
  const meta = buildRaceResultMetadata({ message: { author_name: "A", score: 1, text: long }, candidate: "B" }, "id");
  assert.equal(meta.description.length, 200);
  assert.ok(meta.description.endsWith("…"));
});

test("unknown author and candidate fall back to neutral labels", () => {
  const meta = buildRaceResultMetadata({ message: { author_name: "", score: 0, text: "" }, candidate: "" }, "id");
  assert.match(meta.title, /Anonymous Spite/);
  assert.match(meta.title, /no candidate/);
  assert.equal(meta.description, "A verdict from the guillotine.");
});

test("share payload is a reply-first text+image payload", () => {
  const payload = buildSharePayload(
    { id: "msg_123", authorName: "John Smith", score: 4, candidate: "Musk", messageText: "A well-aimed line" },
    { baseUrl: "https://www.fuckyouelon.net" },
  );
  assert.equal(payload.kind, "reply-first");
  assert.match(payload.text, /John Smith scored 4\/5 on Musk/);
  assert.ok(payload.text.includes(payload.url), "body must carry the permalink");
  assert.equal(payload.url, "https://www.fuckyouelon.net/race/msg_123");
  assert.equal(payload.imageUrl, "https://www.fuckyouelon.net/race/msg_123/opengraph-image");
  assert.match(payload.imageAlt, /4\/5/);
});

test("share payload prepends reply context and trims the base URL", () => {
  const payload = buildSharePayload(
    { id: "m1", authorName: "A", score: 5, candidate: "Trump", messageText: "line" },
    { baseUrl: "https://x.test/", replyContext: "Replying to @someone:" },
  );
  assert.ok(payload.text.startsWith("Replying to @someone:"));
  assert.ok(payload.url.startsWith("https://x.test/race/m1"));
});

test("share payload clamps out-of-range scores and tolerates empty text", () => {
  const high = buildSharePayload({ id: "m2", authorName: "A", score: 99, candidate: "B", messageText: "" }, {});
  assert.match(high.text, /5\/5/);
  const low = buildSharePayload({ id: "m3", authorName: "A", score: -3, candidate: "B", messageText: "  " }, {});
  assert.match(low.text, /0\/5/);
});
