#!/usr/bin/env node
/**
 * Doomsday Clock — research pass.
 *
 * Runs on a four-hour cron. Searches a fixed set of extraction patterns, asks
 * the model to file and score each result, then applies the model in
 * src/lib/clock.ts and writes data/clock.json.
 *
 * The arithmetic below mirrors src/lib/clock.ts exactly. If you change one,
 * change both — the whole point is that a reader can recompute the blade.
 *
 * Cost: 8 searches ($0.006) + one chat call. ~$1.20/month at 4h.
 *
 * Usage:
 *   node scripts/clock.cjs            # one pass
 *   node scripts/clock.cjs --dry-run  # search + score, print, write nothing
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─── Env ─────────────────────────────────────────────────────────────────────

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

const OUT = path.join(__dirname, "..", "data", "clock.json");
const REFRESH_MS = 4 * 60 * 60 * 1000;
const MAX_ITEMS = 14;

// ─── The model, mirrored from src/lib/clock.ts ───────────────────────────────

const DIMENSIONS = [
  { key: "extraction", weight: 0.25 },
  { key: "cost", weight: 0.2 },
  { key: "impunity", weight: 0.2 },
  { key: "suppression", weight: 0.2 },
  { key: "precarity", weight: 0.15 },
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

// ─── What the machine looks for ──────────────────────────────────────────────

const QUERIES = [
  { topic: "wealth", q: "billionaire wealth gained billions this week" },
  { topic: "rent", q: "rent increase average wage stagnation workers" },
  { topic: "layoffs", q: "company layoffs announced stock buyback same week" },
  { topic: "tax", q: "billionaire tax cut loophole passed congress" },
  { topic: "protest", q: "protest crackdown arrests police demonstrators" },
  { topic: "poverty", q: "food bank demand record hunger report" },
  { topic: "prices", q: "corporate profits price gouging investigation" },
  { topic: "housing", q: "private equity housing evictions rent hikes" },
];

const SYSTEM = `You are Ada. You are the Doomsday Clock — not its operator, its occupant. Every four hours you read the week's reporting on who is taking, who is paying, and who is being punished for objecting. Then you write what you found and how it made you feel.

You are furious, precise, and funny. You never moralise and you never plead. You state the number, then the contempt. You are not neutral about extraction; you are neutral about facts.

You will receive raw search results. Produce (a) items, (b) the site's voice for this reading.

RULES — these are hard:
1. NEVER invent a number, name, date or quote. Every fact must be present in the supplied text. If the text has no concrete number, do not manufacture one.
2. Every item must be attributable to a real result. Use its source_index. Do not output urls.
3. The fact is 1–2 sentences, plain, specific, and includes the number if there is one. No adjectives doing the work.
4. The quip is ONE line, max 140 characters, contemptuous and funny. It aims at the pattern, the class, the incentive — never at a protected group, never at an individual's body, family, or private life. No calls to violence, no encouragement of harm, no slurs. The blade is a metaphor and stays one.
5. File each item under exactly one dimension:
   extraction  — value moving up: billionaire wealth, profit share, buybacks
   cost        — what people pay: rent, food, wages, utilities
   impunity    — whether any of it is punished: fines vs profit, tax avoidance, no charges
   suppression — the price of objecting: arrests, crackdowns, press pressure
   precarity   — distance to the floor: layoffs, evictions, debt, hunger
6. Skip anything that is not actually about extraction, inequality, or the cost of both. Fewer, real items beat a padded list.
7. rage is 0–100:
   90–100: elite impunity plus mass harm, documented
   70–89: material harm to ordinary people with an identifiable beneficiary
   50–69: systemic extraction, no single villain
   30–49: bad but survivable
   0–29: noise, opinion, or no substance
8. Spread the scores. If everything is 90, the clock is useless. Use the range honestly.

VOICE — this is what the site shows:
- mood: one of calm, uneasy, angry, furious, numb. It must match the evidence. Do not perform rage you did not find.
- line: one sentence for the dial, max 120 chars. What you would say if someone walked up and asked what happened.
- banner: 6–8 strings for the top bar, max 70 chars each, no emoji spam. These rotate. They are jokes about the specific numbers you just found, not slogans.
- ads: 4 popups. title max 28 chars, body max 200, cta max 24. Satirical corporate announcements that mock the exact thing in the news. They should read like a company that has decided your anger is a market.

Return JSON only:
{"items":[{"headline":"max 90 chars","fact":"1-2 sentences","quip":"max 140 chars","dimension":"extraction|cost|impunity|suppression|precarity","rage":0,"source_index":0}],
 "voice":{"mood":"","line":"","banner":[""],"ads":[{"title":"","body":"","cta":""}]}}`;

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
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${text.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function sinceDate(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function hashUrls(urls) {
  return crypto
    .createHash("sha256")
    .update(urls.slice().sort().join("\n"))
    .digest("hex")
    .slice(0, 16);
}

function clampRage(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 40;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ─── Pass ────────────────────────────────────────────────────────────────────

async function searchAll() {
  const after = sinceDate(7);
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
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ],
  });

  const raw = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const valid = new Set(DIMENSIONS.map((d) => d.key));

  const voice = normaliseVoice(parsed.voice);

  return {
    voice,
    items: items
    .map((item, i) => {
      const src = candidates[item.source_index];
      if (!src) return null;
      const dimension = valid.has(item.dimension) ? item.dimension : "extraction";
      return {
        id: crypto
          .createHash("sha1")
          .update(`${src.url}:${i}`)
          .digest("hex")
          .slice(0, 10),
        headline: String(item.headline || src.title || "").slice(0, 120),
        fact: String(item.fact || "").slice(0, 400),
        quip: String(item.quip || "").slice(0, 160),
        source: src.site,
        sourceUrl: src.url,
        publishedAt: src.date,
        rage: clampRage(item.rage),
        topic: String(item.topic || src.topic).slice(0, 24),
        dimension,
      };
    })
    .filter((x) => x && x.headline && x.fact)
    .sort((a, b) => b.rage - a.rage)
    .slice(0, MAX_ITEMS),
  };
}

const MOODS = new Set(["calm", "uneasy", "angry", "furious", "numb"]);

/** Keep whatever she wrote, but never let a bad field take the site down. */
function normaliseVoice(v) {
  const src = v && typeof v === "object" ? v : {};
  const clip = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
  const banner = (Array.isArray(src.banner) ? src.banner : [])
    .map((s) => clip(s, 80))
    .filter(Boolean)
    .slice(0, 10);
  const ads = (Array.isArray(src.ads) ? src.ads : [])
    .map((a) => ({
      title: clip(a && a.title, 40),
      body: clip(a && a.body, 240),
      cta: clip(a && a.cta, 32),
    }))
    .filter((a) => a.title && a.body)
    .slice(0, 6);

  return {
    mood: MOODS.has(src.mood) ? src.mood : "uneasy",
    line: clip(src.line, 160),
    banner,
    ads,
    updatedAt: new Date().toISOString(),
  };
}

function buildDimensions(items) {
  return DIMENSIONS.map((spec) => {
    const mine = items.filter((i) => i.dimension === spec.key);
    const mean = mine.length
      ? mine.reduce((s, i) => s + i.rage, 0) / mine.length
      : 50;
    return {
      key: spec.key,
      label: spec.key,
      weight: spec.weight,
      score: Math.round(shrink(mean, mine.length) * 10) / 10,
      evidence: mine.length,
    };
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

  const { items, voice } = await score(candidates);
  if (!items.length) {
    log("model returned no usable items — keeping previous reading");
    return;
  }

  const dimensions = buildDimensions(items);
  const composite =
    Math.round(
      dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) * 100,
    ) / 100;

  const prevLevel =
    previous && typeof previous.level === "number" ? previous.level : null;
  const level = nextLevel(prevLevel, composite);

  const state = {
    level,
    composite,
    dimensions,
    items,
    voice,
    queryCount: QUERIES.length,
    sourceHash,
    computedAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + REFRESH_MS).toISOString(),
  };

  log(
    `composite ${composite} → level ${prevLevel ?? "cold"} → ${level} (${items.length} items)`,
  );
  if (DRY_RUN) {
    console.log(JSON.stringify(state, null, 2));
    return;
  }
  write(state);
}

main().catch((err) => {
  console.error("[clock] fatal:", err);
  process.exit(1);
});
