const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const code = ts.transpileModule(fs.readFileSync("src/lib/seat-alert.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(code, { module: moduleValue, exports: moduleValue.exports, Date, JSON });

const { SEAT_ALERT_LEAD_MS, seatAlertDelay, seatAlertLabel, parseReservation } =
  moduleValue.exports;

const five = 5 * 60 * 1000;
const at = "2026-11-12T17:00:00.000Z";
const before = Date.UTC(2026, 10, 12, 12, 0, 0);

assert.equal(seatAlertDelay(at, before), 4 * 60 * 60 * 1000 + 55 * 60 * 1000);
assert.equal(seatAlertDelay(at, before, five), Date.parse(at) - five - before);
assert.equal(seatAlertDelay(at, Date.parse(at) - 10 * 60 * 1000), 5 * 60 * 1000);
assert.equal(seatAlertDelay(at, Date.parse(at) - 2 * 60 * 1000), 0, "Inside the window warns immediately");
assert.equal(seatAlertDelay(at, Date.parse(at)), null, "Never warn after the blade");
assert.equal(seatAlertDelay(at, Date.parse(at) + 1000), null);
assert.equal(seatAlertDelay("not a date", before), null);
assert.equal(seatAlertDelay("", before), null);
assert.equal(SEAT_ALERT_LEAD_MS, five);
assert.equal(seatAlertLabel(at), "16:55 UTC");
assert.equal(seatAlertLabel("not a date"), "");

const saved = { at, name: "Min Aung Hlaing", slug: "min-aung-hlaing" };
assert.equal(JSON.stringify(parseReservation(JSON.stringify(saved))), JSON.stringify(saved));
for (const raw of [null, "", "{", "null", "[]", JSON.stringify({ at, name: "x" }),
  JSON.stringify({ at: "nope", name: "x", slug: "x" }),
  JSON.stringify({ at, name: "  ", slug: "x" }),
  JSON.stringify({ at, name: "x", slug: "" })]) {
  assert.equal(parseReservation(raw), null, `Reject malformed reservation: ${raw}`);
}

console.log("Seat alert: five-minute warning, window, expiry, label and stored reservation pass");
