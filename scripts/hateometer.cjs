#!/usr/bin/env node
/**
 * Hateometer — research pass.
 *
 * Runs on a twelve-hour cron. Same shape as scripts/clock.cjs: search a fixed
 * set of conflict patterns, have the model file and score each result, then
 * apply the model in src/lib/hateometer.ts.
 *
 * Two outputs in one file:
 *   level    — the aggregate index (weighted, shrunk, EWMA with a cap)
 *   figures  — named public officials ranked by how much documented harm is
 *              reported in their name, with movement since the last pass
 *
 * Cost: 6 searches + one chat call, twice a day. ~$0.36/month.
 *
 * Usage:
 *   node scripts/hateometer.cjs            # one pass
 *   node scripts/hateometer.cjs --dry-run  # print, write nothing
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnv() {
  const file = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnv();

const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const MODEL = process.env.OPENAI_MODEL || "deepseek-flash";
const DRY_RUN = process.argv.includes("--dry-run");

const OUT = path.join(__dirname, "..", "data", "hateometer.json");
const REFRESH_MS = 12 * 60 * 60 * 1000;
const MAX_ITEMS = 14;
const MAX_FIGURES = 12;

// ─── Model, mirrored from src/lib/hateometer.ts ──────────────────────────────

const DIMENSIONS = [
  { key: "war", weight: 0.25 },
  { key: "civilian", weight: 0.25 },
  { key: "repression", weight: 0.2 },
  { key: "arms", weight: 0.15 },
  { key: "incitement", weight: 0.15 },
];
const SHRINK_M = 3;
const ALPHA = 0.12;
const MAX_STEP = 6;
const LEVEL_FLOOR = 15;
const LEVEL_CEIL = 99.5;

const shrink = (mean, n) => (n <= 0 ? 50 : (n * mean + SHRINK_M * 50) / (n + SHRINK_M));
const clampLevel = (v) =>
  Math.round(Math.max(LEVEL_FLOOR, Math.min(LEVEL_CEIL, v)) * 100) / 100;

function nextLevel(previous, composite) {
  if (previous === null || !Number.isFinite(previous)) return clampLevel(composite);
  const raw = previous + ALPHA * (composite - previous);
  return clampLevel(Math.max(previous - MAX_STEP, Math.min(previous + MAX_STEP, raw)));
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const QUERIES = [
  { topic: "strikes", q: "airstrike kills civilians casualties" },
  { topic: "ceasefire", q: "ceasefire talks collapse fighting resumes" },
  { topic: "arms", q: "military aid arms sale approved weapons package" },
  { topic: "crackdown", q: "protesters arrested crackdown emergency powers" },
  { topic: "justice", q: "war crimes arrest warrant investigation" },
  { topic: "displacement", q: "displaced famine siege humanitarian crisis" },
];

const SYSTEM = `You are the scoring engine of a satirical installation called the Hateometer. It measures how much documented war, repression and the arms trade behind both is being reported this week.

You will receive raw search results. Turn them into (a) items and (b) named public figures.

RULES — these are hard:
1. NEVER invent a name, number, date, quote or event. Everything must be present in the supplied text.
2. Items: 1–2 plain sentences with the concrete number if there is one. No adjectives doing the work.
3. Quip: ONE line, max 140 characters, contemptuous and funny, aimed at the pattern or the institution. No calls to violence, no encouragement of harm, no dehumanising language, nothing about anyone's body, family, ethnicity or religion.
4. File each item under exactly one dimension:
   war         — combat intensity: strikes, offensives, mobilisation
   civilian    — civilian harm: deaths, displacement, famine, sieges
   repression  — the price of dissent: arrests, bans, emergency powers, press
   arms        — the trade: arms sales, aid packages, defence contracts
   incitement  — rhetoric that licenses harm: threats, dehumanisation, orders
5. harm is 0–100, how severe the reported event is:
   90–100: mass civilian harm, documented
   70–89: significant lethal violence or systematic repression
   50–69: structural harm, escalation, or the machinery that feeds it
   30–49: tension without documented harm
   0–29: noise, opinion, or no substance
6. Figures: only name a person who is EXPLICITLY named in the supplied text AND holds a role with decision-making power over force: head of state or government, defence or interior minister, military commander, security-service chief, or the executive of an arms manufacturer. EXCLUDE anyone the text presents as a critic, investigator, mediator, negotiator, aid worker, lawyer, witness, victim, or human-rights official — being named in a report about harm is not the same as being responsible for it. No inference. No private individuals. No speculation about motive or guilt; state only what the report says they did or ordered. If no qualifying person appears, return an empty figures list.
7. Each figure cites item_indices (the items above that name them). Do not include a figure with no items.

Return JSON only:
{"items":[{"headline":"max 90 chars","fact":"1-2 sentences","quip":"max 140 chars","dimension":"war|civilian|repression|arms|incitement","harm":0,"source_index":0}],
 "figures":[{"name":"","role":"","country":"","reason":"one sentence, max 120 chars, what the reporting says","item_indices":[0]}]}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

async function post(url, body, timeoutMs = 90_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const sinceDate = (days) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const hashUrls = (urls) =>
  crypto.createHash("sha256").update(urls.slice().sort().join("\n")).digest("hex").slice(0, 16);

const clampHarm = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 40;
};

// ─── Pass ────────────────────────────────────────────────────────────────────

async function searchAll() {
  const after = sinceDate(4);
  const results = [];
  for (const { topic, q } of QUERIES) {
    try {
      const data = await post(`${BASE_URL}/v1/tools/search`, {
        query: `${q} lang:en after:${after}`,
        count: 5,
        need_content: false,
      });
      const hits = (data.results || []).filter((r) => r.url && r.summary);
      log(`search ${topic}: ${hits.length} hits`);
      for (const hit of hits) {
        results.push({
          topic,
          title: hit.title,
          url: hit.url,
          site: hit.site_name || "unknown",
          date: hit.date || null,
          summary: hit.summary,
          authority: typeof hit.authority === "number" ? hit.authority : -1,
        });
      }
    } catch (err) {
      log(`search ${topic} failed: ${err.message}`);
    }
  }
  const byUrl = new Map();
  for (const r of results) {
    const prev = byUrl.get(r.url);
    if (!prev || r.authority > prev.authority) byUrl.set(r.url, r);
  }
  return [...byUrl.values()].sort((a, b) => b.authority - a.authority);
}

async function score(candidates) {
  const payload = candidates.slice(0, 24).map((c, i) => ({
    index: i,
    topic: c.topic,
    title: c.title,
    site: c.site,
    date: c.date,
    summary: c.summary.slice(0, 900),
  }));

  const data = await post(`${BASE_URL}/chat/completions`, {
    model: MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
  });

  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  const valid = new Set(DIMENSIONS.map((d) => d.key));

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

  // Keep the model's order for figure citations; sort a copy for display.
  const mapped = rawItems.map((item, i) => {
    const src = candidates[item.source_index];
    if (!src) return null;
    return {
      id: crypto.createHash("sha1").update(`${src.url}:${i}`).digest("hex").slice(0, 10),
      headline: String(item.headline || src.title || "").slice(0, 120),
      fact: String(item.fact || "").slice(0, 400),
      quip: String(item.quip || "").slice(0, 160),
      source: src.site,
      sourceUrl: src.url,
      publishedAt: src.date,
      harm: clampHarm(item.harm),
      dimension: valid.has(item.dimension) ? item.dimension : "war",
    };
  });

  const items = mapped
    .filter((x) => x && x.headline && x.fact)
    .sort((a, b) => b.harm - a.harm)
    .slice(0, MAX_ITEMS);

  const rawFigures = Array.isArray(parsed.figures) ? parsed.figures : [];
  const figures = [];
  for (const f of rawFigures) {
    const name = String(f.name || "").trim().slice(0, 80);
    if (!name) continue;
    const cited = (Array.isArray(f.item_indices) ? f.item_indices : [])
      .map((i) => mapped[i])
      .filter(Boolean);
    if (!cited.length) continue;
    const mean = cited.reduce((s, i) => s + i.harm, 0) / cited.length;
    figures.push({
      name,
      role: String(f.role || "").slice(0, 60),
      country: String(f.country || "").slice(0, 40),
      score: Math.round(shrink(mean, cited.length) * 10) / 10,
      mentions: cited.length,
      reason: String(f.reason || "").slice(0, 160),
      source: cited[0].source,
      sourceUrl: cited[0].sourceUrl,
    });
  }

  return { items, figures };
}

function buildDimensions(items) {
  return DIMENSIONS.map((spec) => {
    const mine = items.filter((i) => i.dimension === spec.key);
    const mean = mine.length ? mine.reduce((s, i) => s + i.harm, 0) / mine.length : 50;
    return {
      key: spec.key,
      label: spec.key,
      weight: spec.weight,
      score: Math.round(shrink(mean, mine.length) * 10) / 10,
      evidence: mine.length,
    };
  });
}

function rankFigures(next, previous) {
  const prevRank = new Map((previous || []).map((f) => [f.name.toLowerCase(), f.rank]));
  return next
    .slice()
    .sort((a, b) => b.score - a.score || b.mentions - a.mentions)
    .slice(0, MAX_FIGURES)
    .map((f, i) => {
      const rank = i + 1;
      const was = prevRank.get(f.name.toLowerCase()) ?? null;
      return { ...f, rank, prevRank: was, delta: was === null ? null : was - rank };
    });
}

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch {
    return null;
  }
}

function write(state) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmp = `${OUT}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, OUT);
}

async function main() {
  if (!API_KEY) {
    log("no DEEPSEEK_API_KEY — aborting");
    process.exit(1);
  }

  const previous = readPrevious();
  const candidates = await searchAll();
  if (!candidates.length) {
    log("no candidates — keeping previous reading");
    return;
  }

  const sourceHash = hashUrls(candidates.map((c) => c.url));
  if (previous && previous.sourceHash === sourceHash && Array.isArray(previous.items)) {
    log("results unchanged — keeping previous scores");
    if (!DRY_RUN) {
      write({
        ...previous,
        computedAt: new Date().toISOString(),
        nextRunAt: new Date(Date.now() + REFRESH_MS).toISOString(),
      });
    }
    return;
  }

  const { items, figures: rawFigures } = await score(candidates);
  if (!items.length) {
    log("model returned no usable items — keeping previous reading");
    return;
  }

  const dimensions = buildDimensions(items);
  const composite =
    Math.round(dimensions.reduce((s, d) => s + d.weight * d.score, 0) * 100) / 100;
  const prevLevel = previous && typeof previous.level === "number" ? previous.level : null;
  const level = nextLevel(prevLevel, composite);
  const figures = rankFigures(rawFigures, previous?.figures);

  const state = {
    level,
    composite,
    dimensions,
    items,
    figures,
    queryCount: QUERIES.length,
    sourceHash,
    computedAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + REFRESH_MS).toISOString(),
  };

  log(
    `composite ${composite} → level ${prevLevel ?? "cold"} → ${level}; ${items.length} items, ${figures.length} figures`,
  );
  if (DRY_RUN) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  write(state);
}

main().catch((err) => {
  console.error("[hateometer] fatal:", err);
  process.exit(1);
});
