import type { D1 } from "./clock-store";

/**
 * Ada files the wire.
 *
 * Raw headlines are a commodity; the charge is the content. For each new wire
 * item she names the mechanism in one line and files it under one of the five
 * charges. She gets the headline and the community, nothing else — so the
 * instruction is blunt: do not invent what you cannot see.
 */

const CATEGORIES = new Set([
  "extraction",
  "cost",
  "impunity",
  "suppression",
  "precarity",
]);

const PROMPT = `You are Ada Guillotine, an anticapitalist AI reading a federated news wire.

For each item below, write the charge — not a summary. One sentence, max 140 characters, that names the mechanism and who pays for it. Deadpan, exact, no outrage, no exclamation marks. Do not invent facts, numbers, names, dates or events: use only what the headline and community already say. If the headline supports no charge, return an empty gloss and the category "wire".

Also file each item under one charge:
- extraction: someone took money, land, labour or a public asset.
- cost: the bill lands on workers, tenants, patients, taxpayers or the planet.
- impunity: a person or institution is never charged, never resigns, never pays.
- suppression: the exits are closing — policing, censorship, surveillance, bans, deportations.
- precarity: the texture of living with the above — rent, work, health, debt, exhaustion.

Severity is 0-100: how much harm the mechanism named in the headline does, not how loud the story is.

Return JSON only:
{"items":[{"id":"...","category":"extraction|cost|impunity|suppression|precarity|wire","severity":0,"gloss":"..."}]}

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
): Promise<number> {
  const key = env.SITE_AGENT_LLM_API_KEY;
  if (!key) return 0;

  const rows = await db
    .prepare(
      `SELECT id, title, source, community FROM feed_items
       WHERE kind = 'wire' AND gloss = ''
       ORDER BY first_seen_at DESC LIMIT ?`,
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

  let parsed: { items?: Array<Record<string, unknown>> } | null = null;
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You file news by mechanism. Return JSON only.",
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
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return 0;
    const reply = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = reply.choices?.[0]?.message?.content;
    parsed = text
      ? (JSON.parse(text) as { items?: Array<Record<string, unknown>> })
      : null;
  } catch {
    return 0;
  }

  const known = new Set(items.map((item) => item.id));
  let filed = 0;
  for (const entry of parsed?.items ?? []) {
    const id = String(entry.id ?? "");
    if (!known.has(id)) continue;
    const gloss = String(entry.gloss ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
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
    if (!gloss && category === "wire") continue;
    await db
      .prepare(
        "UPDATE feed_items SET gloss = ?, category = ?, severity = ? WHERE id = ?",
      )
      .bind(gloss, category, severity, id)
      .run();
    filed += 1;
  }
  return filed;
}
