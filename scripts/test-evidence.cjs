const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const code = ts.transpileModule(fs.readFileSync("src/lib/evidence.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(code, {
  module: moduleValue,
  exports: moduleValue.exports,
  console,
  Date,
  Math,
  Number,
  String,
  Object,
  JSON,
});

const { evidenceFor, actDate, inBand, EVIDENCE_WINDOW_DAYS } = moduleValue.exports;

const NOW = Date.parse("2026-11-13T12:00:00Z");
const act = (over) => ({
  act: "Bombed a market",
  year: 2026,
  category: "war",
  confidence: 80,
  ...over,
});

// A dated act inside the window counts whole.
const inside = evidenceFor([act({ act: "On 4 November 2026 forces shelled a market." })], NOW);
assert.equal(inside.acts, 1, "a dated act inside the window counts whole");
assert.ok(inside.score > 0);
assert.equal(inside.newest.date, "2026-11-04");
assert.equal(inside.newest.weight, 1);

// A dated act outside the window counts nothing.
const outside = evidenceFor([act({ act: "On 2 January 2026 forces shelled a market." })], NOW);
assert.equal(outside.acts, 0, "January is outside a November 180-day window");
assert.equal(outside.score, 0);
assert.equal(outside.newest, null);

// A bare year cannot prove recency, so it counts half.
const undated = evidenceFor([act({ act: "Forces shelled a market.", year: 2026 })], NOW);
assert.equal(undated.acts, 0.5, "an undated act this year counts half");

// An undated act from an older year does not count at all.
const old = evidenceFor([act({ act: "Forces shelled a market.", year: 2024 })], NOW);
assert.equal(old.score, 0, "no recent date, no score");

// The window is 180 days, not a calendar year.
const edge = evidenceFor([act({ act: "On 20 May 2026 a market was shelled." })], NOW);
assert.equal(edge.acts, 1);
const justOutside = evidenceFor([act({ act: "On 1 May 2026 a market was shelled." })], NOW);
assert.equal(justOutside.acts, 0);
assert.equal(EVIDENCE_WINDOW_DAYS, 180);

// More documented harm scores higher, and the score saturates.
const one = evidenceFor([act({ act: "On 4 November 2026 forces shelled a market." })], NOW);
const five = evidenceFor(
  Array.from({ length: 5 }, (_, i) =>
    act({ act: `On ${4 + i} November 2026 forces shelled market ${i}.` }),
  ),
  NOW,
);
const fifty = evidenceFor(
  Array.from({ length: 50 }, (_, i) =>
    act({ act: `On ${1 + (i % 9)} November 2026 forces shelled market ${i}.` }),
  ),
  NOW,
);
assert.ok(five.score > one.score, "more acts, higher score");
assert.ok(fifty.score > five.score, "still higher");
assert.ok(fifty.score <= 100, "capped at 100");
assert.ok(
  fifty.score - five.score < 30,
  "the top saturates instead of running away",
);

// Category and confidence both matter.
const war = evidenceFor([act({ act: "On 4 November 2026 forces shelled a market.", confidence: 80 })], NOW);
const finance = evidenceFor(
  [act({ act: "On 4 November 2026 a fund bought a stake.", category: "finance", confidence: 80 })],
  NOW,
);
assert.ok(war.score > finance.score, "a massacre outweighs a share purchase");
const sure = evidenceFor([act({ act: "On 4 November 2026 forces shelled a market.", confidence: 90 })], NOW);
const unsure = evidenceFor([act({ act: "On 4 November 2026 forces shelled a market.", confidence: 45 })], NOW);
assert.ok(sure.score > unsure.score, "confidence weighs");

// The card prefers the newest act the record is confident about.
const mixed = evidenceFor(
  [
    act({ act: "On 9 November 2026 a press strategy was agreed.", category: "media", confidence: 40 }),
    act({ act: "On 2 November 2026 forces shelled a market.", category: "war", confidence: 80 }),
  ],
  NOW,
);
assert.equal(mixed.newest.date, "2026-11-02", "a thin newest act does not headline the card");

// A future date is a model slip and falls back to the year.
const future = evidenceFor([act({ act: "On 1 March 2027 forces shelled a market." })], NOW);
assert.equal(future.acts, 0.5, "a future date is treated as a bare year");

// The blade band.
assert.equal(inBand(0, 70), false);
assert.equal(inBand(70, 70), true);
assert.equal(inBand(69.9, 70), false);

console.log("Evidence: 180-day window, weighted by confidence and category, no old-fame floor");
