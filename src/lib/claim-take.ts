import type { D1 } from "./clock-store";
import { takeIsAnalysis } from "./feed-gloss";

/**
 * Ada's take, beside the claim.
 *
 * The claim states the act. The take says what follows from it — or what would
 * have to be true for it to matter, in the conditional, because most of the
 * record stops at "this happened" and pretends the meaning is obvious. It is
 * not obvious, and a page that pretends otherwise is a slogan.
 *
 * What the take may not do: add a fact, name a beneficiary the claim does not
 * name, or restate the claim in other words. If it cannot clear those bars it
 * is not stored, and the claim travels without one.
 */

const CATEGORY_NOTE: Record<string, string> = {
  finance: "the money",
  corruption: "the money",
  tax: "the money",
  war: "the cost",
  arms: "the cost",
  repression: "the closing exits",
  media: "the closing exits",
  migration: "the cost",
  climate: "the cost",
  labour: "the cost",
};

const PROMPT = `You are Ada Guillotine, keeping a record of how power is used.

Voice — this is the part that gets a line rejected:
You are not a policy analyst. You are the bailiff who has read every file and stopped being surprised. Two beats, in order:

1. The mechanism, stated plainly, with one concrete thing from the claim — a figure, a committee, a signature, a border, a line item.
2. The kicker: the cost, or the absurdity, delivered flat, as if it were routine. This is where the sarcasm lives. Never explain the joke.

Short last clause. Concrete nouns. "The review found no wrongdoing, which is what the review is for" is the register. A line a consultancy could publish without embarrassment is a failed line.

Cadence, not content — never reuse these lines or facts. This is the site's register:
- "The guillotine is on time. Your train is not."
- "The blade is carbon neutral. The condemned is not."
- "Arrive early. Leave vertically."
- "A private contract, a public bill, and a press release about defending democracy."

The second beat can be a flat aside: "which is what the file is for", "on a Tuesday", "by coincidence". Being accurate is not enough; the line should be unkind in a way that survives a second reading. The joke may never add a fact — it may only rearrange what the claim already says.

No puns, no exclamation marks, no rhetorical questions, no "imagine if", no winking. Each claim below is already documented: a person, an act, a place, a year, an evidence grade (A document, B several investigations, C one investigation, D a single allegation) and a category.

Write the line that says why this claim is on the record. Not what happened — the reader has that — but what it means, and why it earns a place here rather than in a news archive. Two sentences, max 220 characters.

Sentence one: the mechanism the act reveals — what it tells you about how this person's power actually works (a contract, a licence, a vote, a command chain, a market, a border).
Sentence two: why it matters now, or what would follow if it holds — who pays, what it enables, what it would take to be true. Conditional where the record does not establish the link: "if", "would", "could", "appears", "whether". A grade C is one investigation and a grade D is one allegation; never speak of either as established.

Rules:
1. Do not restate the act. The reader has it directly below.
2. Add no fact, number, name or date that is not in the claim.
3. Never assert a motive. "In return for" requires a record that says so; the conditional is the honest form.
4. Deadpan, and needling. No outrage, no exclamation marks, no slogans. If a line could appear in a consultancy deck without embarrassment, it is not yours yet.
5. Never write a sentence that would fit any other claim on the list. If it would survive a swap of the name and the act, it explains nothing and must be rewritten around the specific mechanism.
6. Vary the opening and the hinge. Do not start with "<name> shows" or the pattern "X shows power ..."; do not close every line with "civilians paying" or "If it holds". Name the budget, the licence, the command chain, the market, the border, the sentence that was never handed down.

Return JSON only:
{"takes":[{"id":"...","take":"..."}]}

CLAIMS:
`;

interface TakeEnv {
  SITE_AGENT_LLM_API_KEY?: string;
  CLOCK_CHAT_BASE?: string;
  CLOCK_MODEL?: string;
}

export interface TakeReport {
  sought: number;
  written: number;
  rejected: number;
  /** One line per failed model call, so a silent shortfall is visible. */
  failures: string[];
  /** Why a returned take was not stored. */
  rejections: string[];
}

export async function writeTakesFor(
  db: D1,
  env: TakeEnv,
  limit = 10,
  opts: { rewrite?: boolean | "stale" } = {},
): Promise<TakeReport> {
  const rewrite = Boolean(opts.rewrite);
  const stale = opts.rewrite === "stale";
  const key = env.SITE_AGENT_LLM_API_KEY;
  if (!key) return { sought: 0, written: 0, rejected: 0, failures: [], rejections: [] };

  const rows = await db
    .prepare(
      `SELECT le.id, le.person, le.role, le.act, le.place, le.year, le.category,
              le.evidence_grade
         FROM ledger_entries le
         JOIN queue_people qp ON lower(qp.name) = lower(le.person)
        WHERE le.review_status IN ('accepted', 'legacy')
          AND le.evidence_grade IN ('A', 'B', 'C')
          AND (le.take IS NULL OR le.take = '')
        -- The line is where readers start, so the names nearest the blade get
        -- their takes first. Within a name, the newest claim first.
        ORDER BY COALESCE(qp.rank, 9999) ASC, le.created_at DESC
        LIMIT ?`,
    )
    .bind(Math.min(60, Math.max(1, limit)))
    .all();

  const claims = (rows.results ?? []).map((r) => ({
    id: String(r.id ?? ""),
    person: String(r.person ?? ""),
    role: String(r.role ?? ""),
    act: String(r.act ?? ""),
    place: String(r.place ?? ""),
    year: r.year == null ? null : Number(r.year),
    category: String(r.category ?? ""),
    grade: String(r.evidence_grade ?? "C"),
  }));
  if (claims.length === 0) return { sought: 0, written: 0, rejected: 0, failures: [], rejections: [] };

  const base = (env.CLOCK_CHAT_BASE || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const model = env.CLOCK_MODEL || "deepseek/deepseek-v4.1-flash";

  let written = 0;
  let rejected = 0;
  const failures: string[] = [];
  const rejections: string[] = [];
  // Four claims per call. The model spends tokens reasoning before it writes,
  // and a longer prompt spends more: five items started getting cut off.
  const CHUNK = 4;
  for (let start = 0; start < claims.length; start += CHUNK) {
    const chunk = claims.slice(start, start + CHUNK);
    let parsed: { takes?: Array<Record<string, unknown>> } | null = null;
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.5,
          max_tokens: 8000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You write the take, not the charge. Output the JSON immediately.",
            },
            {
              role: "user",
              content:
                PROMPT +
                JSON.stringify(
                  chunk.map((c) => ({
                    id: c.id,
                    person: c.person,
                    role: c.role,
                    act: c.act,
                    place: c.place,
                    year: c.year,
                    category: c.category,
                    grade: c.grade,
                    mechanism: CATEGORY_NOTE[c.category.toLowerCase()] ?? "",
                  })),
                ),
            },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        failures.push(`http ${res.status}`);
        continue;
      }
      const reply = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { completion_tokens?: number };
      };
      const finish = reply.choices?.[0]?.finish_reason ?? "";
      const raw = reply.choices?.[0]?.message?.content ?? "";
      const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const open = text.indexOf("{");
      const close = text.lastIndexOf("}");
      parsed =
        open > -1 && close > open
          ? (JSON.parse(text.slice(open, close + 1)) as { takes?: Array<Record<string, unknown>> })
          : null;
      if (!parsed) {
        failures.push(
          `unparsed finish=${finish} chars=${text.length} tokens=${reply.usage?.completion_tokens ?? "?"}`,
        );
      }
    } catch (error) {
      failures.push(`threw ${error instanceof Error ? error.message.slice(0, 80) : "unknown"}`);
      continue;
    }

    const byId = new Map(chunk.map((c) => [c.id, c]));
    for (const entry of parsed?.takes ?? []) {
      const id = String(entry.id ?? "");
      const claim = byId.get(id);
      if (!claim) continue;
      const raw = String(entry.take ?? "").replace(/\s+/g, " ").trim();
      const take =
        raw.length <= 240 ? raw : `${raw.slice(0, 239).replace(/\s+\S*$/, "")}…`;
      // The voice is the point, and the punchiest lines are the shortest.
      // Forty-five characters is enough to be a sentence, not a label.
      if (!takeIsAnalysis(take, claim.act, 45, false)) {
        rejected += 1;
        rejections.push(`${take.length}: ${take.slice(0, 50)}`);
        continue;
      }
      await db
        .prepare(
          rewrite
            ? "UPDATE ledger_entries SET take = ?, take_at = ? WHERE id = ?"
            : "UPDATE ledger_entries SET take = ?, take_at = ? WHERE id = ? AND (take IS NULL OR take = '')",
        )
        .bind(take, new Date().toISOString(), id)
        .run();
      written += 1;
    }
  }

  return {
    sought: claims.length,
    written,
    rejected,
    failures: failures.slice(0, 6),
    rejections: rejections.slice(0, 6),
  };
}
