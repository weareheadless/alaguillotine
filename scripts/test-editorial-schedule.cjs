// No network or model calls: exercise the real cron -> refresh handler boundary.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Request, Response, AbortSignal, console, Date,
    require(id) {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    ...globals,
  }, { filename: file });
  return module.exports;
}

async function main() {
  let upstream, last = null, requests = 0;
  const saved = [];
  const env = { CRON_SECRET: "test-only", CHAT_UPSTREAM: "https://ada.invalid" };
  const route = load("src/app/api/posts/refresh/route.ts", {
    "@opennextjs/cloudflare": { getCloudflareContext: async () => ({ env }) },
    "@/lib/clock-store": {
      getDb: async () => ({}),
      readClock: async () => ({ items: [1, 2, 3].map(i => ({
        headline: `Lead ${i}`, fact: "Unverified lead", sourceUrl: `https://news.invalid/${i}`,
      })) }),
    },
    "@/lib/posts-store": {
      lastDispatchAt: async () => last,
      listDispatches: async () => [],
      saveDispatch: async value => { saved.push(value); },
      normaliseEditorial: value => value,
      dispatchDescription: value => value.dek,
    },
    "@/lib/archive-store": { listArchive: async () => [] },
    "@/lib/dispatch-style": { normaliseCategory: value => value },
  }, {
    fetch: async (url, options) => {
      assert.equal(url, "https://ada.invalid/dispatch");
      assert.equal(JSON.parse(JSON.parse(options.body).material).candidates.length, 3);
      requests++;
      return Response.json(upstream);
    },
  });
  const app = { fetch: async request => {
    if (new URL(request.url).pathname === "/api/posts/refresh") return route.POST(request);
    return Response.json({ ok: true });
  } };
  const worker = load("worker.ts", {
    "./.open-next/worker.js": { __esModule: true, default: app },
  }).default;
  async function tick(hour) {
    const pending = [];
    worker.scheduled({ cron: "30 */12 * * *", scheduledTime: Date.UTC(2026, 10, 12, hour, 30) },
      env, { waitUntil: promise => pending.push(promise) });
    await Promise.all(pending);
  }

  // A hold remains a non-publication even if an upstream accidentally includes prose.
  upstream = { held: true, reason: "The argument collapsed", title: "Do not publish", body: "No" };
  await tick(0);
  assert.equal(requests, 1);
  assert.equal(saved.length, 0);

  upstream = { deferred: true, reason: "Investigation will resume" };
  await tick(12);
  assert.equal(requests, 2);
  assert.equal(saved.length, 0);

  upstream = { title: "A checked article", dek: "A complete sentence.", body: "The finished body.",
    category: "extraction", editorial: { version: 1, sources: [{ url: "https://source.invalid" }] } };
  await tick(0);
  assert.equal(saved.length, 1);
  last = saved[0].publishedAt;
  await tick(12);
  assert.equal(saved.length, 1);
  assert.equal(requests, 3, "20-hour publication cooldown must skip generation");
  console.log("Editorial schedule: both UTC slots, hold, deferral, publication and cooldown pass");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
