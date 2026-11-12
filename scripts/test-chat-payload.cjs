const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const code = ts.transpileModule(fs.readFileSync("src/lib/chat-payload.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(code, { module: moduleValue, exports: moduleValue.exports, JSON });

const { DROPPED_LINE, parsePayload } = moduleValue.exports;

assert.deepEqual(parsePayload('{"reply":"bonjour"}'), { reply: "bonjour" });
assert.deepEqual(parsePayload('{"ok":false,"error":"busy"}'), { ok: false, error: "busy" });

// What nginx actually serves when a service dies mid-request.
const nginx502 = "error code: 502\n";
assert.equal(parsePayload(nginx502), null);
assert.equal(parsePayload("<html><body>502 Bad Gateway</body></html>"), null);
assert.equal(parsePayload(""), null);
assert.equal(parsePayload("   "), null);

// JSON that is not an object is not a chat payload.
assert.equal(parsePayload("null"), null);
assert.equal(parsePayload("[]"), null);
assert.equal(parsePayload('"error code: 502"'), null);
assert.equal(parsePayload("502"), null);

// The fallback must never leak the parse failure or an internal error string.
for (const leak of ["JSON", "Unexpected token", "error code", "502", "nginx"]) {
  assert.ok(!DROPPED_LINE.includes(leak), `fallback leaks ${leak}`);
}
assert.ok(DROPPED_LINE.length < 120, "fallback stays one line");

console.log("Chat payload: proxy error pages are rejected; fallback leaks no internals");
