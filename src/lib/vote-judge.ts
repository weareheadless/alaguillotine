/**
 * The judge that reads roll calls.
 *
 * Hand-written filters rot. "Arms" and "Israel" caught nothing about the motion
 * to table an impeachment, and the next war will be called something else
 * again. So the classification is a judgment, not a list of words: for each
 * roll call, what did a Yea actually do — move force, move money for force,
 * shield someone from the consequences of force, or nothing at all?
 *
 * What the model never does is supply a fact. The names, the votes, the bill
 * number, the date and the roll number all come from the clerk's own XML. The
 * judge only says which side of the vote is the harmful act, which category it
 * belongs to, and how much of it is the individual member's own — and it says
 * so once, in a cached verdict that can be read, argued with and re-run.
 *
 * A verdict of "relief" is not a charge. A ceasefire resolution, an arms
 * embargo, a conditions amendment: a Yea there is the restraint, so the machine
 * files nothing and the member is left alone.
 */

export type VoteHarm = "arms" | "impunity" | "relief" | "none";

export interface Verdict {
  harm: VoteHarm;
  /** Which votes cast the harmful act. Never both sides of the same roll. */
  charged: Array<"yea" | "nay" | "present">;
  /** 0–1: how much of the act is the individual member's own. */
  attribution: number;
  /** One sentence on what the vote did, for the audit. */
  why: string;
}

type Row = Record<string, unknown>;

type JudgeDb = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      run: () => Promise<unknown>;
      all: <T = { results?: Row[] }>() => Promise<T>;
    };
  };
};

const SYSTEM = `You are the judge for a public ledger of documented political harm. You do not decide who is guilty and you do not write charges. You decide what a roll call DID, so a machine can file it without a hand-written rule for every bill that will ever be introduced.

For each roll call, return:
- harm: "arms" when the measure moves weapons, money for weapons, or military support to a party to a conflict. "impunity" when it shields a named official from accountability — impeachment, contempt, censure, an inquiry, ethics — or removes oversight of force. "relief" when the measure restrains arms, conditions aid, ends a war, or exposes an official: a Yea there is the restraint and must not be charged. "none" for routine business — post offices, commemorations, appointments, budget bookkeeping with no force in it, and anything whose purpose the title does not make clear.
- charged: which votes cast the harmful act, as a list of "yea", "nay", "present". A Yea on passage of an arms bill charges yea. A Yea on a motion to table or refer an impeachment charges yea, because tabling kills it. A Nay on the only measure that would restrain arms charges nay.

Abstention is a judgment, not a rule. Each roll carries present_decides: true when the motion would have failed with every Present voting against it, meaning the abstentions are what let it through. Charge "present" only when present_decides is true and the abstention was on the side that mattered. When present_decides is false, the abstention changed nothing and must not be charged — a Present that did not decide anything is a shrug, and this ledger does not charge shrugs. Never charge both sides of one roll.
- attribution: 0 to 1, how much the act is that individual member's own. Be strict, because this number is compared against heads of state. One vote inside a 435-member authorisation, where the bill passes anyway: 0.1 to 0.2. A single procedural vote, even a decisive one on one official's accountability: 0.25 to 0.4 — one of four hundred and thirty-five hands. The named sponsor or floor manager of the measure: 0.4 to 0.6. A motion carried by a handful of votes where the member's own vote was required: 0.5. Unanimous consent: 0.05. Never above 0.6 for a vote; authorship is the ceiling, not the vote.
- why: one sentence, at most 140 characters, saying what the vote did.

Read the question, not only the title. "On Motion to Table X" is a vote to kill X. "On Motion to Refer X" sends X somewhere to die. "On Agreeing to the Amendment" may be either direction — decide from what the amendment would do, and if the title does not say, return "none".

Do not guess. A wrong charge is worse than a missing one.

Return JSON only, one entry per roll, same order:
{"verdicts":[{"roll":298,"harm":"impunity","charged":["yea"],"attribution":0.8,"why":"A Yea tabled the impeachment resolution, killing it before debate."}]}`;

const keyOf = (year: number, roll: number): string => `${year}:${roll}`;

const normalHarm = (v: unknown): VoteHarm => {
  const t = String(v ?? "").toLowerCase();
  return t === "arms" || t === "impunity" || t === "relief" || t === "none" ? t : "none";
};

const normalCharged = (v: unknown): Verdict["charged"] =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x).toLowerCase())
    .filter((x): x is "yea" | "nay" | "present" => x === "yea" || x === "nay" || x === "present");

export interface JudgeableRoll {
  year: number;
  roll: number;
  date: string;
  bill: string;
  title: string;
  question: string;
  result: string;
  /** Party and vote tallies, so the judge can see whether a vote was decisive. */
  tally: string;
  /** True when the result would have flipped if every Present had voted No. */
  presentDecides: boolean;
  url: string;
}

const post = async <T,>(url: string, body: unknown, key: string): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
};

/** Cached verdicts, so a vote is judged once and can be audited afterwards. */
export async function readVerdicts(
  db: JudgeDb,
  rolls: JudgeableRoll[],
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  if (rolls.length === 0) return out;
  const keys = rolls.map((r) => keyOf(r.year, r.roll));
  try {
    const rows = await db
      .prepare(
        `SELECT key, verdict FROM vote_verdicts WHERE key IN (${keys.map(() => "?").join(",")})`,
      )
      .bind(...keys)
      .all();
    for (const r of rows.results ?? []) {
      try {
        out.set(String(r.key), JSON.parse(String(r.verdict)) as Verdict);
      } catch {
        /* a corrupt row is a miss, not a crash */
      }
    }
  } catch {
    /* table absent on an older deployment */
  }
  return out;
}

export async function writeVerdict(
  db: JudgeDb,
  roll: JudgeableRoll,
  verdict: Verdict,
  model: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO vote_verdicts (key, chamber, roll, year, bill, title, question, verdict, model, at)
         VALUES (?, 'house', ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET verdict = excluded.verdict, model = excluded.model, at = excluded.at`,
      )
      .bind(
        keyOf(roll.year, roll.roll),
        roll.roll,
        roll.year,
        roll.bill,
        roll.title,
        roll.question,
        JSON.stringify(verdict),
        model,
        new Date().toISOString(),
      )
      .run();
  } catch {
    /* the verdict still applies to this run */
  }
}

/**
 * Judge the rolls that have no verdict yet. Batches of eight: one call for a
 * fortnight of floor votes, and the rubric does not fit in a smaller prompt.
 */
export async function judgeRolls(
  config: { chatBase: string; chatKey: string; chatModel: string },
  db: JudgeDb,
  rolls: JudgeableRoll[],
): Promise<Map<string, Verdict>> {
  const known = await readVerdicts(db, rolls);
  const missing = rolls.filter((r) => !known.has(keyOf(r.year, r.roll)));

  for (let i = 0; i < missing.length; i += 8) {
    const batch = missing.slice(i, i + 8);
    let parsed: { verdicts?: Array<Record<string, unknown>> } = {};
    try {
      parsed = await post<{ verdicts?: Array<Record<string, unknown>> }>(
        `${config.chatBase}/chat/completions`,
        {
          model: config.chatModel,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: JSON.stringify(
                batch.map((r) => ({
                  roll: r.roll,
                  date: r.date,
                  bill: r.bill,
                  title: r.title,
                  question: r.question,
                  result: r.result,
                  tally: r.tally,
                  present_decides: r.presentDecides,
                })),
              ),
            },
          ],
        },
        config.chatKey,
      );
    } catch {
      continue;
    }

    const raw = (parsed as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content;
    const text = String(raw ?? "").replace(/```json|```/g, "").trim();
    if (!text) continue;

    let list: Array<Record<string, unknown>> = [];
    try {
      list = (JSON.parse(text) as { verdicts?: Array<Record<string, unknown>> }).verdicts ?? [];
    } catch {
      continue;
    }

    for (const item of list) {
      const rollNumber = Number(item.roll ?? 0);
      const roll = batch.find((r) => r.roll === rollNumber);
      if (!roll) continue;
      const verdict: Verdict = {
        harm: normalHarm(item.harm),
        charged: normalCharged(item.charged),
        attribution: Math.min(1, Math.max(0, Number(item.attribution ?? 0))),
        why: String(item.why ?? "").slice(0, 200),
      };
      known.set(keyOf(roll.year, roll.roll), verdict);
      await writeVerdict(db, roll, verdict, config.chatModel);
    }
  }

  return known;
}
