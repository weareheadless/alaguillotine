import type { D1 } from "./clock-store";

/**
 * Ada files the wire.
 *
 * Raw headlines are a commodity; the take is the content. For each new wire
 * item Ada writes what the piece shows and why it is or could be relevant, in
 * the conditional where the link is not established. She gets the headline and
 * the community, nothing else — so the instruction is blunt: do not invent what
 * you cannot see, and do not repeat what the headline already said.
 */

const CATEGORIES = new Set([
  "extraction",
  "cost",
  "impunity",
  "suppression",
  "precarity",
]);

/**
 * Written into `gloss` when a wire story names no actor to hold responsible.
 * The feed query excludes these, and the glosser never retries them.
 */
export const UNGROUNDED_GLOSS = "∅ ungrounded";

/** One-run diagnostics for the cron path; safe to leave empty in normal use. */
export const glossDiagnostics: Record<string, unknown> = {};

/**
 * Accusations that are not actors. "Profiteers extract from genocide" tells a
 * reader nothing they can check or hold to account; a charge has to name who.
 */
const GENERIC_ACTORS = new Set([
  "profiteer",
  "profiteers",
  "elite",
  "elites",
  "capitalism",
  "capital",
  "capitalists",
  "system",
  "systems",
  "power",
  "powerful",
  "rich",
  "wealthy",
  "forces",
  "interests",
  "corporations",
  "corporation",
  "companies",
  "company",
  "institutions",
  "institution",
  "markets",
  "market",
]);

/**
 * A charge is publishable only when the named actor actually appears in it.
 * The glosser sees the headline alone, so an unnamed headline must produce an
 * empty actor rather than a slogan with a villain-shaped hole in it.
 */
const ACTOR_STOP = new Set([
  "the", "and", "of", "for", "inc", "corp", "co", "ltd", "llc", "plc",
  "group", "company", "department", "ministry", "office", "agency",
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !ACTOR_STOP.has(word));
}

const ANALYSIS_MARK = /\b(if|would|could|may|might|means|implies|because|suggests|unless|until|whether|what follows|the test|if true|if confirmed)\b/i;

/**
 * A take has to add a step the headline does not have.
 *
 * Two failures are mechanical and worth catching before publication: a take
 * that is the headline in other words, and a take that asserts without
 * reasoning. Overlap is measured on content words, so "Musk buys X" and "X
 * bought by Musk" score as the same sentence — because to a reader they are.
 */
export function takeIsAnalysis(take: string, title: string, minLength = 60): boolean {
  const t = take.replace(/\s+/g, " ").trim();
  if (t.length < minLength || t.length > 260) return false;
  if (!ANALYSIS_MARK.test(t)) return false;
  const content = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !ACTOR_STOP.has(w)),
    );
  const A = content(t);
  const B = content(title);
  if (B.size === 0) return true;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  return shared / Math.min(A.size, B.size) < 0.6;
}

export function glossIsGrounded(gloss: string, actor: string): boolean {
  const charge = (gloss || "").replace(/\s+/g, " ").trim();
  const who = (actor || "").replace(/\s+/g, " ").trim();
  if (charge.length < 30 || who.length < 3) return false;
  const actorWords = words(who);
  if (actorWords.length === 0) return false;
  // "Profiteers", "the powerful": every word is a slogan, not a name.
  if (actorWords.every((word) => GENERIC_ACTORS.has(word))) return false;
  const chargeWords = new Set(words(charge));
  return actorWords.some((word) => chargeWords.has(word));
}

const PROMPT = `You are Ada Guillotine, an anticapitalist AI reading a federated news wire.

For each item, write your take — analysis, not a charge and not a summary. Two sentences, max 240 characters.

Voice — this is the part that gets a line rejected:
You are not a summariser and not a policy analyst. You are the bailiff who has read every file and stopped being surprised. Put the claim and the official description in the same breath and let the gap do the damage. Short sentences, concrete nouns. A line that could appear in a press release without embarrassment is a failure.

Cadence, not content — never reuse these facts:
- "The review found no wrongdoing, which is what the review is for."
- "A public service, a private contract, and a press release about transparency."
- "They call it a partnership. The invoice calls it something else."

No puns, no exclamation marks, no rhetorical questions, no "imagine if".

Sentence one: what the piece actually shows, in your own words.
Sentence two: why it is relevant, or could be — the mechanism, who carries the cost, what it would mean if it holds.

Rules, in order of importance:
1. Never restate the headline. If your take could be written by reading only the headline, it is worthless. Add the step the headline leaves out: what follows from it, or what would have to be true.
2. Conditional when the link is not established: "if", "would", "could", "appears", "may", "whether". Never assert a motive the piece does not establish.
3. No new facts. No numbers, names, dates or events that are not in the headline or the community line.
4. Deadpan, and needling. No outrage, no exclamation marks, no slogan ("profiteers", "the powerful", "late capitalism"). If a line could appear in a press release without embarrassment, it is not yours yet.

Also file each item:
- extraction: someone took money, land, labour or a public asset.
- cost: the bill lands on workers, tenants, patients, taxpayers or the planet.
- impunity: a person or institution is never charged, never resigns, never pays.
- suppression: the exits are closing — policing, censorship, surveillance, bans, deportations.
- precarity: the texture of living with the above — rent, work, health, debt, exhaustion.

Severity 0-100: how much harm the mechanism does, not how loud the story is.

Return JSON only:
{"items":[{"id":"...","category":"extraction|cost|impunity|suppression|precarity|wire","severity":0,"take":"..."}]}

ITEMS:
`;

interface GlossEnv {
  SITE_AGENT_LLM_API_KEY?: string;
  CLOCK_CHAT_BASE?: string;
  CLOCK_MODEL?: string;
}

export async function glossFeed(
  db: D1,
  env: GlossEnv,
  limit = 12,
  opts: { rewrite?: boolean } = {},
): Promise<number> {
  const rewrite = Boolean(opts.rewrite);
  const key = env.SITE_AGENT_LLM_API_KEY;
  glossDiagnostics.key = Boolean(key);
  if (!key) return 0;

  // Glosses written before the take rule are charges in disguise: a sentence
  // that repeats the headline and calls it analysis. They are cleared here and
  // go back through the same validator as everything else — one attempt, then
  // either a take that reasons or the ungrounded mark, never a loop.
  try {
    const stale = await db
      .prepare(
        `SELECT id, title, gloss FROM feed_items
          WHERE kind = 'wire' AND gloss != '' AND gloss NOT LIKE '∅%'
          ORDER BY first_seen_at DESC LIMIT 40`,
      )
      .bind()
      .all();
    for (const row of stale.results ?? []) {
      const id = String(row.id ?? "");
      if (!id) continue;
      if (takeIsAnalysis(String(row.gloss ?? ""), String(row.title ?? ""))) continue;
      await db.prepare("UPDATE feed_items SET gloss = '', category = 'wire', severity = 0 WHERE id = ?").bind(id).run();
    }
  } catch {
    /* revalidation is best effort; it never blocks the pass */
  }

  const rows = await db
    .prepare(
      rewrite
        ? `SELECT id, title, source, community, gloss FROM feed_items
            WHERE kind = 'wire' AND gloss != '' AND gloss NOT LIKE '∅%'
            ORDER BY first_seen_at ASC LIMIT ?`
        : `SELECT id, title, source, community FROM feed_items
            WHERE kind = 'wire' AND gloss = ''
            ORDER BY first_seen_at ASC LIMIT ?`,
    )
    .bind(limit)
    .all();
  const items = (rows.results ?? []).map((row) => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    source: String(row.source ?? ""),
    community: String(row.community ?? ""),
  }));
  if (items.length === 0) return 0;

  const base = (env.CLOCK_CHAT_BASE || "https://openrouter.ai/api/v1").replace(
    /\/$/,
    "",
  );
  const model = env.CLOCK_MODEL || "deepseek/deepseek-v4.1-flash";

  // The model spends tokens on private reasoning before it writes content.
  // Five items fit inside that budget; twelve get cut off with content: null.
  const CHUNK = 5;
  let filed = 0;
  for (let start = 0; start < items.length; start += CHUNK) {
    filed += await glossChunk(db, { base, model, key }, items.slice(start, start + CHUNK), rewrite);
  }
  glossDiagnostics.filed = filed;
  glossDiagnostics.rows = items.length;
  console.error("gloss_done", filed, "of", items.length);
  return filed;
}

async function glossChunk(
  db: D1,
  ctx: { base: string; model: string; key: string },
  items: Array<{ id: string; title: string; source: string; community: string }>,
  rewrite = false,
): Promise<number> {
  let parsed: { items?: Array<Record<string, unknown>> } | null = null;
  try {
    const res = await fetch(`${ctx.base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ctx.key}`,
      },
      body: JSON.stringify({
        model: ctx.model,
        temperature: 0.6,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You file news by mechanism. Output the JSON immediately, without deliberation.",
          },
          {
            role: "user",
            content:
              PROMPT +
              JSON.stringify(
                items.map((item) => ({
                  id: item.id,
                  headline: item.title,
                  community: item.community,
                })),
              ),
          },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      glossDiagnostics.status = res.status;
      glossDiagnostics.body = body;
      console.error("gloss_http", res.status, body);
      return 0;
    }
    const reply = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const raw = reply.choices?.[0]?.message?.content ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const open = text.indexOf("{");
    const close = text.lastIndexOf("}");
    parsed = open > -1 && close > open
      ? (JSON.parse(text.slice(open, close + 1)) as { items?: Array<Record<string, unknown>> })
      : null;
    glossDiagnostics.finish = reply.choices?.[0]?.finish_reason ?? "";
  } catch (error) {
    glossDiagnostics.error = String(error);
    console.error("gloss_failed", error);
    return 0;
  }
  glossDiagnostics.parsed = parsed?.items?.length ?? -1;

  const byId = new Map(items.map((item) => [item.id, item]));
  let filed = 0;
  for (const entry of parsed?.items ?? []) {
    const id = String(entry.id ?? "");
    const item = byId.get(id);
    if (!item) continue;
    const rawTake = String(entry.take ?? entry.gloss ?? "").replace(/\s+/g, " ").trim();
    const take = rawTake.length <= 260 ? rawTake : `${rawTake.slice(0, 259).replace(/\s+\S*$/, "")}…`;
    const rawCategory = String(entry.category ?? "").trim().toLowerCase();
    const category =
      rawCategory === "wire"
        ? "wire"
        : CATEGORIES.has(rawCategory)
          ? rawCategory
          : "wire";
    const severity = Math.max(
      0,
      Math.min(100, Math.round(Number(entry.severity ?? 0))),
    );
    // A take that only re-words the headline is not a take. On a first pass it
    // is marked and kept out of the feed; on a rewrite the old take stays,
    // because a failed rewrite should not cost the card.
    if (!takeIsAnalysis(take, item.title)) {
      if (rewrite) continue;
      await db
        .prepare(
          "UPDATE feed_items SET gloss = ?, category = 'wire', severity = 0 WHERE id = ?",
        )
        .bind(UNGROUNDED_GLOSS, id)
        .run();
      continue;
    }
    await db
      .prepare(
        "UPDATE feed_items SET gloss = ?, category = ?, severity = ? WHERE id = ?",
      )
      .bind(take, category, severity, id)
      .run();
    filed += 1;
  }
  return filed;
}
