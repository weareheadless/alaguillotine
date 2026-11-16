/**
 * The judge that reads a sentence for an act.
 *
 * A regular expression can find a name and a verb. It cannot tell whether the
 * verb belongs to the name, whether the sentence is about someone else, or
 * whether what happened is the kind of thing this record exists for. Joe Biden
 * was filed under Trump's cuts, Mamdani under a PAC's spending by his
 * supporters, and both read as charges when neither was his act — or, in
 * Mamdani's case, a harm at all.
 *
 * So the decision is a judgment: is this person the actor, and is this the use
 * of power the site records — or is it ordinary politics, opposition to harm,
 * victimhood, or someone else's conduct? The model never supplies a fact: the
 * sentence, the name, the outlet and the link all come from the stored article.
 * It says only whether the row belongs and under which reading. The verdict is
 * cached, so a sentence is judged once.
 */

export type ActActor = "person" | "other" | "unclear";
export type ActHarm = "harm" | "politics" | "victim" | "unclear";

export interface ActVerdict {
  actor: ActActor;
  harm: ActHarm;
  category: string;
  why: string;
}

export interface JudgeItem {
  /** Stable within one call; maps the verdict back to the sentence. */
  id: string;
  name: string;
  sentence: string;
  outlet: string;
  title: string;
}

export interface JudgeConfig {
  key: string;
  base: string;
  model: string;
}

/** Chat only: the judge reads a sentence, it does not search the web. */
export function judgeConfig(env: {
  SITE_AGENT_LLM_API_KEY?: string;
  CLOCK_CHAT_BASE?: string;
  CLOCK_MODEL?: string;
}): JudgeConfig | null {
  if (!env.SITE_AGENT_LLM_API_KEY) return null;
  return {
    key: env.SITE_AGENT_LLM_API_KEY,
    base: (env.CLOCK_CHAT_BASE || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
    model: env.CLOCK_MODEL || "deepseek/deepseek-v4.1-flash",
  };
}

const CATEGORIES = new Set([
  "money", "influence", "war", "repression",
  "finance", "extraction", "labour", "climate",
  "impunity", "media", "arms", "genocide", "migration", "other",
]);

export function keepsVerdict(verdict: ActVerdict): boolean {
  return verdict.actor === "person" && verdict.harm === "harm";
}

const SYSTEM = `You judge sentences for a public record of the powerful and the harm they do with power.

The record is a guillotine. It lists people who use wealth or office to injure others or to escape the consequences: war, weapons, repression, surveillance, deportation, extraction, pollution, wage theft, fraud, corruption, self-dealing, media capture, obstruction of accountability — and money used as leverage over politics: large political spending, lobbying, dark money, buying access to contracts or regulators. It does NOT list people for ordinary politics. Opposing a war or a genocide, advocating for victims, campaigning, voting, charity, criticism of the powerful — these are not charges on this record, and the person who does them is not a name for it.

For each item decide three things.

1. actor:
- "person" when the named person is the grammatical subject who did the act.
- "other" when the sentence is about someone else and names this person only as background: an office held ("under President X", "while X was in office"), a supporter/donor/critic/ally of someone, a quote by someone else, the owner of an object someone else acted on ("X's bill", "X's company was lobbied"), or a person merely present.
- "unclear" when the grammar does not establish who acted.

2. harm:
- "harm" when the act is the use of power to injure, kill, extract, silence, defraud, or shield from consequence — including a government policy whose purpose is to remove protection from people or the climate — OR when a wealthy or powerful person uses money as leverage over politics: a substantial donation, contribution, lobbying spend, or fundraising for a party, candidate, PAC or policy, or buying access to contracts or regulators. The size and the leverage are what make it an act of power. Someone with a named dollar amount, a PAC, a lobbying firm or an office is using leverage.
- "politics" when it is ordinary political activity without that leverage: casting a vote, running for office, campaigning, opposing a war or a policy, advocacy, negotiation, charity, criticism of the powerful, or a small personal donation by someone who is not using wealth to buy influence.
- "victim" when the named person is the one harmed or investigated.
- "unclear" when the sentence does not say what was done.

3. category, one of:
money = finance, extraction, labour, climate; influence = impunity, media; war = war, arms, genocide; repression = repression, migration. Use the specific word when it fits ("arms", "finance", "impunity"), otherwise the broad one.

4. why: one clause, at most 120 characters, saying which test it failed or passed.

Keep only actor "person" AND harm "harm". When the actor is in doubt, choose "other" or "unclear": a wrong row is worse than a missing one. A PAC spending money is not an act by the candidate its supporters back. A sentence about Biden being lobbied is not an act by Biden.

Examples:
- "Led by American Priorities PAC ... including supporters of Mayor Zohran Mamdani ... spent $14.4 million on races" -> actor "other" (supporters, not him), harm "politics" (opposition to military aid), keep false.
- "Musk's SpaceX was awarded a $6 billion contract while he led DOGE" -> actor "person", harm "harm" (self-dealing), category "finance", keep true.
- "Yass contributed $450,000 to Sugar Maple in the lead-up to the primary" -> actor "person", harm "harm" (a donor using money as leverage), category "influence", keep true.
- "A nurse donated $50 to a food bank" -> actor "person", harm "politics" (no leverage), keep false.
- "Trump's administration killed EV incentives" -> actor "person", harm "harm" (climate policy), category "climate", keep true.
- "Biden's administration failed to pay WHO dues" -> actor "person", harm "unclear" (an omission with no stated injury), keep false.
- "Protesters were deported by the interior ministry" -> actor "other", keep false.

Return JSON only:
{"verdicts":[{"id":"...","actor":"person","harm":"harm","category":"finance","why":"..."}]}`;

type JudgeDb = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      run: () => Promise<unknown>;
      all: <T = { results?: Array<Record<string, unknown>> }>() => Promise<T>;
    };
  };
};

export function actKey(name: string, sentence: string): string {
  return `${name.trim().toLowerCase()}|${sentence.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 220)}`;
}

function normalVerdict(item: Record<string, unknown>): ActVerdict {
  const actorRaw = String(item.actor ?? "").toLowerCase();
  const harmRaw = String(item.harm ?? "").toLowerCase();
  const actor: ActActor =
    actorRaw === "person" ? "person" : actorRaw === "other" ? "other" : "unclear";
  const harm: ActHarm =
    harmRaw === "harm" ? "harm" : harmRaw === "politics" ? "politics" : harmRaw === "victim" ? "victim" : "unclear";
  const categoryRaw = String(item.category ?? "").toLowerCase();
  return {
    actor,
    harm,
    category: CATEGORIES.has(categoryRaw) ? categoryRaw : "other",
    why: String(item.why ?? "").slice(0, 160),
  };
}

async function readVerdicts(
  db: JudgeDb,
  items: JudgeItem[],
): Promise<Map<string, ActVerdict>> {
  const found = new Map<string, ActVerdict>();
  if (!items.length) return found;
  try {
    const rows = await db
      .prepare("SELECT act_key, actor, harm, category, why FROM act_verdicts")
      .bind()
      .all();
    const byKey = new Map<string, ActVerdict>();
    for (const row of rows.results ?? []) {
      byKey.set(String(row.act_key ?? ""), normalVerdict(row));
    }
    for (const item of items) {
      const verdict = byKey.get(actKey(item.name, item.sentence));
      if (verdict) found.set(item.id, verdict);
    }
  } catch {
    /* no cache yet: every item is judged */
  }
  return found;
}

async function post(base: string, key: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`judge ${res.status}`);
  return res.json();
}

/**
 * Judge the items that have no cached verdict. Batches of eight: one call per
 * article, and a sentence is never paid for twice.
 */
export async function judgeActs(
  config: JudgeConfig | null,
  db: JudgeDb,
  items: JudgeItem[],
  failures: string[] = [],
): Promise<Map<string, ActVerdict>> {
  const verdicts = await readVerdicts(db, items);
  if (!config) return verdicts;

  const missing = items.filter((item) => !verdicts.has(item.id));
  for (let i = 0; i < missing.length; i += 6) {
    const batch = missing.slice(i, i + 6);
    let parsed: { verdicts?: Array<Record<string, unknown>> } | null = null;
    try {
      parsed = (await post(config.base, config.key, {
        model: config.model,
        temperature: 0,
        max_tokens: 6000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content:
              "Judge every item below. Return one verdict for each id, including when the verdict is to keep it out.\n" +
              JSON.stringify(
                batch.map((item) => ({
                  id: item.id,
                  name: item.name,
                  outlet: item.outlet,
                  title: item.title.slice(0, 160),
                  sentence: item.sentence.slice(0, 700),
                })),
              ),
          },
        ],
      })) as { verdicts?: Array<Record<string, unknown>> };
    } catch (error) {
      failures.push(`call: ${String(error).slice(0, 120)}`);
      continue;
    }

    const raw = (parsed as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content;
    const text = String(raw ?? "").replace(/```json|```/g, "").trim();
    if (!text) {
      failures.push("empty content");
      continue;
    }

    let list: Array<Record<string, unknown>> = [];
    try {
      const parsedJson = JSON.parse(text) as Record<string, unknown>;
      const candidate = parsedJson.verdicts ?? parsedJson.items ?? parsedJson.results ?? parsedJson.acts;
      list = Array.isArray(candidate) ? (candidate as Array<Record<string, unknown>>) : [];
    } catch {
      failures.push(`parse: ${text.slice(0, 200)}`);
      continue;
    }
    if (list.length < batch.length) {
      const finish = (parsed as { choices?: Array<{ finish_reason?: string }> }).choices?.[0]?.finish_reason;
      failures.push(
        `short: ${list.length}/${batch.length} (${finish ?? "?"}) :: ${text.slice(0, 200)}`,
      );
    }

    const writes: Array<Promise<unknown>> = [];
    for (const entry of list) {
      const item = batch.find((candidate) => candidate.id === String(entry.id ?? ""));
      if (!item) continue;
      const verdict = normalVerdict(entry);
      verdicts.set(item.id, verdict);
      writes.push(
        db
          .prepare(
            `INSERT INTO act_verdicts (act_key, actor, harm, category, why, at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(act_key) DO UPDATE SET
               actor = excluded.actor, harm = excluded.harm,
               category = excluded.category, why = excluded.why, at = excluded.at`,
          )
          .bind(
            actKey(item.name, item.sentence),
            verdict.actor,
            verdict.harm,
            verdict.category,
            verdict.why,
            new Date().toISOString(),
          )
          .run(),
      );
    }
    await Promise.all(writes);
  }

  return verdicts;
}

