const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const code = ts.transpileModule(fs.readFileSync("src/lib/feed-gloss.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(code, { module: moduleValue, exports: moduleValue.exports });

const { glossIsGrounded, UNGROUNDED_GLOSS } = moduleValue.exports;

assert.equal(
  glossIsGrounded("Boeing cut 5% of its workforce while buying back its own shares.", "Boeing"),
  true,
  "a named company that appears in the charge is grounded",
);
assert.equal(
  glossIsGrounded("BlackRock bought 12,000 homes in Atlanta while rents rose 31%.", "BlackRock"),
  true,
);
assert.equal(
  glossIsGrounded("Profiteers extract from genocide while its victims pay.", "profiteers"),
  false,
  "an accusation is not an actor",
);
assert.equal(
  glossIsGrounded("The powerful extract from genocide while its victims pay.", "the powerful"),
  false,
);
assert.equal(glossIsGrounded("Boeing cut 5% of its workforce while buying back shares.", ""), false);
assert.equal(glossIsGrounded("Boeing cut 5% of its workforce while buying back shares.", "Airbus"), false,
  "the named actor has to actually appear in the charge");
assert.equal(glossIsGrounded("Profiteers profit.", "profiteers"), false,
  "too short to explain anything");
assert.equal(UNGROUNDED_GLOSS, "∅ ungrounded");

console.log("Feed gloss: charges require a named actor that appears in the sentence");
