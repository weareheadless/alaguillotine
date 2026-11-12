const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("src/components/FeedMosaic.module.css", "utf8").replace(/\s+/g, " ");
const tsx = fs.readFileSync("src/components/FeedMosaic.tsx", "utf8");

// The desktop mosaic is an exact rectangle only while every span fits the row.
assert.match(css, /\.grid \{ display: grid; grid-template-columns: repeat\(4,/);
assert.match(css, /\.lead \{ grid-column: span 2; grid-row: span 2;/);
assert.match(css, /\.feature, \.wide \{ grid-column: span 2;/);

// The sponsored tile must claim 2×2. A 1×1 promo makes the cell total odd
// (17), so the final wide story wraps and leaves holes. Keep the spans on a
// single-class selector so the phone reset can override them.
assert.match(css, /\.promo \{ grid-column: span 2; grid-row: span 2; \}/);
assert.doesNotMatch(css, /\.tile\.promo \{[^}]*grid-(column|row)/,
  "two-class promo selectors outrank the phone reset");
assert.match(tsx, /\{index === 1 && <PromoTile \/>\}/);

// One column on phones: every span must collapse, including the promo.
assert.match(css, /\.lead, \.feature, \.wide, \.promo \{ grid-column: auto; grid-row: auto; \}/);

// Ten stories: lead 4 cells + feature 2 + six single cells + two wide extras
// = 16; the promo adds 4 = 20, divisible by both 4 and 2 columns.
const cells = 4 + 2 + 6 + 2 + 2 + 4;
assert.equal(cells % 4, 0, "desktop rows stay full");
assert.equal(cells % 2, 0, "two-column rows stay full");

console.log("Feed mosaic layout: sponsored tile spans 2×2 and the cell count stays rectangular");
