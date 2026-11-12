const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const code = ts.transpileModule(fs.readFileSync("src/lib/feed-mosaic.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(code, { module: moduleValue, exports: moduleValue.exports, Date });
const { mosaicItems, mosaicDate } = moduleValue.exports;
const wire = i => ({ id: String(i), kind: "wire", source: "Newsroom", title: `Story ${i}`,
  url: `https://news.example/${i}`, cluster: `story-${i}` });
const receipt = { ...wire("receipt"), kind: "record", source: "receipt" };
const dispatch = { ...wire("dispatch"), kind: "record", source: "dispatch", publishedAt: new Date().toISOString() };
const input = [wire(0), wire(1), wire(2), dispatch, wire(3), receipt, ...Array.from({ length: 20 }, (_, i) => wire(i + 4))];
const before = JSON.stringify(input);
const chosen = mosaicItems(input);
assert.equal(chosen.length, 10);
assert.equal(chosen[0].id, "0", "The first ranked wire story leads");
assert.equal(chosen[1].source, "receipt", "A real receipt gets the supporting feature slot");
assert.equal(chosen[2].id, "1", "Remaining items keep the feed's order");
assert.equal(JSON.stringify(input), before, "Selection must not mutate feed data");
assert.equal(JSON.stringify(mosaicItems(input)), JSON.stringify(chosen), "Stable ordering, not random masonry");
assert.equal(mosaicItems([dispatch, wire(0)])[0].id, "0");
assert.equal(mosaicItems([dispatch, wire(0)])[1].id, "dispatch");
assert.equal(mosaicItems([receipt])[0].id, "receipt", "No empty feature placeholders");
assert.equal(mosaicItems([{ ...dispatch, publishedAt: "2026-01-01" }], 10, Date.UTC(2026, 10, 12)).length, 0,
  "Do not turn old archived dispatches into homepage features");
assert.equal(mosaicItems([]).length, 0);
assert.equal(mosaicItems(input, 0).length, 0);

const duplicates = [wire(0), wire(0), { ...wire(1), cluster: "story-0" },
  { ...wire(2), url: "http://news.example/0#article" }, wire(3)];
assert.equal(mosaicItems(duplicates).length, 2, "Deduplicate ids, URLs and story clusters");
for (const url of ["javascript:alert(1)", "//evil.example", "data:text/html,hello", ""]) {
  assert.equal(mosaicItems([{ ...wire(1), url }]).length, 0);
}
assert.equal(mosaicItems([{ ...receipt, url: "/person/example" }]).length, 1);
assert.equal(mosaicItems([{ ...wire(0), kind: "ad" }]).length, 0);
assert.equal(mosaicDate("not a date"), "");
assert.equal(mosaicDate("2026-11-12T00:15:00Z"), "12 Nov");
console.log("Feed mosaic: finite, stable, diverse selection; deduplication, safe links and UTC dates pass");

// Run the component's real mount effect with fake hooks: loading must not depend
// on IntersectionObserver, and must neither poll nor update after unmount.
async function testLoading(response, mode = "normal") {
  const effects = [], states = [], updates = [];
  let calls = 0, signal, timeout, cancelled = false;
  const component = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react: {
      useState: initial => {
        const index = states.length;
        states.push(initial);
        return [initial, value => { states[index] = value; updates.push(index); }];
      },
      useEffect: effect => effects.push(effect),
      Fragment: "fragment",
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": { __esModule: true, default: "link" },
    "@/lib/feed-mosaic": { mosaicItems, mosaicDate },
    "@/lib/dispatch-style": {},
    "@/lib/url": {},
    "@/lib/use-promise": { usePromise: () => ({ text: "Solar-powered guillotine production starts on the moon next week. Buy $CHOP.", number: 7 }) },
    "./drawers": { useDrawer: () => ({ show: () => {} }) },
    "./FeedMosaic.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  };
  const source = ts.transpileModule(fs.readFileSync("src/components/FeedMosaic.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module: component, exports: component.exports, AbortController,
    require: id => { assert.ok(id in dependencies, id); return dependencies[id]; },
    window: { setTimeout: callback => { timeout = callback; return 1; },
      clearTimeout: () => { cancelled = true; } },
    fetch: async (url, options) => {
      calls++;
      signal = options.signal;
      assert.equal(url, "/api/feed?limit=24");
      return mode === "timeout" ? new Promise(() => {}) : response;
    },
  });
  component.exports.FeedMosaic();
  assert.equal(effects.length, 1);
  const cleanup = effects[0]();
  if (mode === "timeout") timeout();
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  const status = states.at(-1);
  assert.equal(status, mode === "timeout" || !response.ok ? "error" : "ready");
  if (status === "ready") assert.equal(states[1].length, 10);
  const count = updates.length;
  cleanup();
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
  await new Promise(setImmediate);
  assert.equal(updates.length, count);
}

Promise.resolve()
  .then(() => testLoading({ ok: true, json: async () => ({ items: input }) }))
  .then(() => testLoading({ ok: false }))
  .then(() => testLoading({ ok: true }, "timeout"))
  .then(() => console.log("Feed mosaic loading: one mount fetch, error/timeout states and unmount cleanup pass"))
  .catch(error => { console.error(error); process.exitCode = 1; });
