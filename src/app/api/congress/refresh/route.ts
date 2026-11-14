import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig } from "@/lib/clock-research";
import { loadMembers } from "@/lib/bioguide";
import { getDb, type D1 } from "@/lib/hate-store";
import { ledgerSummaryFor, readLedgerSummaries } from "@/lib/archive-store";
import {
  billLabel,
  prettyDate,
  recentRolls,
  rollsInRange,
  type RollCall,
} from "@/lib/rollcalls";
import { slugify } from "@/lib/slug";
import { judgeRolls, type JudgeableRoll } from "@/lib/vote-judge";

export const dynamic = "force-dynamic";

/**
 * POST /api/congress/refresh — the roll-call pass, judged rather than filtered.
 *
 * The previous version of this route carried a list of words: Israel, arms,
 * UNRWA, defence. That list missed the motion to table an impeachment, and it
 * would miss whatever the next war is called. The classification is now a
 * judgment on each roll call — what did a Yea do, and how much of it is the
 * individual member's — cached as a verdict that can be read and argued with.
 *
 * The facts stay in the record: names from the bioguide map keyed by the ID the
 * clerk prints, votes from the clerk's XML, dates from the roll. The model
 * supplies no name, no number and no date, so it cannot invent one.
 *
 * One rule governs the line: a single procedural vote is a receipt, not a
 * standing. A member enters the queue at the second charged vote in the window.
 * That is the same pattern test the site applies everywhere else — one act is a
 * Tuesday, a record is a record — rather than a special case for Congress.
 */

const VOTE_KEY: Record<string, "yea" | "nay" | "present"> = {
  Yea: "yea",
  Nay: "nay",
  Present: "present",
};

/**
 * Did the abstentions decide it?
 *
 * If every Present had voted against the motion and it still passed, the
 * abstentions changed nothing and are not a charge. If the motion would have
 * failed with them voting, they are what let it through — and then the judge
 * may charge them.
 */
function presentDecides(roll: RollCall): boolean {
  const count = (vote: string) => roll.votes.filter((v) => v.vote === vote).length;
  const margin = count("Yea") - count("Nay");
  const withoutPresent = count("Yea") - (count("Nay") + count("Present"));
  return Math.sign(margin) !== Math.sign(withoutPresent);
}

function tallyOf(roll: RollCall): string {
  const counts = new Map<string, number>();
  for (const v of roll.votes) {
    const key = `${v.party} ${v.vote}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}: ${n}`)
    .join("; ");
}

function actFor(
  roll: RollCall,
  vote: string,
): string {
  const question = roll.question.replace(/^On\s+/i, "").toLowerCase();
  const bill = roll.bill ? billLabel(roll.bill) : "the measure";
  return `Voted ${vote} — ${bill}, "${roll.title}" (${question}) — roll call ${roll.roll}, ${prettyDate(roll.date)}.`;
}

async function ensurePerson(
  db: D1,
  name: string,
  role: string,
  country: string,
  reason: string,
  url: string,
): Promise<boolean> {
  const slug = slugify(name);
  const at = new Date().toISOString();
  const res = (await db
    .prepare(
      `INSERT INTO queue_people (id, name, slug, role, country, reason, score, mentions, rank, prev_rank, added_at, last_seen_at, dropped_at, items, source, source_url, record_bonus)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 999, NULL, ?, ?, NULL, '[]', ?, ?, 0)
       ON CONFLICT(slug) DO NOTHING`,
    )
    .bind(slug, name, slug, role, country, reason, at, at, "U.S. House roll call", url)
    .run()) as { meta?: { changes?: number } };
  return (res.meta?.changes ?? 0) > 0;
}

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: {
      CRON_SECRET?: string;
      DEEPSEEK_API_KEY?: string;
      SITE_AGENT_LLM_API_KEY?: string;
      CLOCK_SEARCH_BASE?: string;
      CLOCK_CHAT_BASE?: string;
      CLOCK_MODEL?: string;
    };
  };

  const secret = context.env?.CRON_SECRET;
  if (!secret || (request.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = clockConfig(context.env ?? {});
  if (!config) return Response.json({ error: "no model key configured" }, { status: 500 });

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 binding unavailable" }, { status: 500 });

  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const rejudge = url.searchParams.get("rejudge") === "1";

  // A slice of a past year, for walking the record back: ?year=2024&from=500&count=120
  const sliceYear = Number(url.searchParams.get("year") ?? 0);
  const sliceFrom = Number(url.searchParams.get("from") ?? 0);
  const sliceCount = Math.min(200, Math.max(1, Number(url.searchParams.get("count") ?? 120)));

  const year = new Date().getUTCFullYear();
  const [members, rolls] = await Promise.all([
    loadMembers(),
    sliceYear > 1900 && sliceFrom > 0
      ? rollsInRange(sliceYear, sliceFrom, sliceCount)
      : recentRolls(deep ? 180 : 40),
  ]);
  const judgeable: JudgeableRoll[] = rolls.map((r) => ({
    year: Number(r.date.slice(0, 4)) || year,
    roll: r.roll,
    date: prettyDate(r.date),
    bill: r.bill,
    title: r.title,
    question: r.question,
    result: r.result,
    tally: tallyOf(r),
    presentDecides: presentDecides(r),
    url: r.url,
  }));

  // A verdict is cached so a vote is judged once. It is not a lifetime
  // appointment: rejudge clears the cache for these rolls so a changed rubric
  // can reconsider them.
  if (rejudge && judgeable.length > 0) {
    try {
      await db
        .prepare(
          `DELETE FROM vote_verdicts WHERE key IN (${judgeable.map(() => "?").join(",")})`,
        )
        .bind(...judgeable.map((r) => `${r.year}:${r.roll}`))
        .run();
    } catch {
      /* the cached verdict stands */
    }
  }

  const verdicts = await judgeRolls(
    { chatBase: config.chatBase, chatKey: config.chatKey, chatModel: config.chatModel },
    db,
    judgeable,
  );

  const report: Array<Record<string, unknown>> = [];
  let filed = 0;

  for (const roll of rolls) {
    const verdict = verdicts.get(`${Number(roll.date.slice(0, 4))}:${roll.roll}`);
    if (!verdict || verdict.harm === "none" || verdict.harm === "relief") continue;
    if (verdict.charged.length === 0) continue;

    const targets = roll.votes.filter(
      (v) => VOTE_KEY[v.vote] && verdict.charged.includes(VOTE_KEY[v.vote]),
    );
    if (targets.length === 0) continue;

    const category = verdict.harm === "impunity" ? "impunity" : "arms";
    const caseId = `vote:${roll.date.slice(0, 4)}:${roll.roll}`;
    const at = new Date().toISOString();
    let written = 0;

    for (const target of targets) {
      const member = members.get(target.id);
      if (!member) continue;
      const act = actFor(roll, target.vote);
      // The bioguide ID is the identity. A display name can be corrected later
      // without leaving a second row for the same hand on the same vote.
      const id = `${target.id}:${caseId}`;
      const res = (await db
        .prepare(
          `INSERT INTO ledger_entries (id, person, role, act, place, year, category, confidence, sources, case_id, created_at, attribution, review_status, act_date, date_precision)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'day')
           ON CONFLICT(id) DO UPDATE SET act = excluded.act, attribution = excluded.attribution,
             person = excluded.person, role = excluded.role`,
        )
        .bind(
          id,
          member.name,
          `Representative, ${member.state}`,
          act,
          "U.S. House of Representatives",
          Number(roll.date.slice(0, 4)),
          category,
          95,
          JSON.stringify([roll.url]),
          caseId,
          at,
          verdict.attribution,
          // The roll call's own day: this is a vote, not a report about one.
          roll.date,
        )
        .run()) as { meta?: { changes?: number } };
      if ((res.meta?.changes ?? 0) > 0) written += 1;
    }

    filed += written;
    report.push({
      roll: roll.roll,
      bill: roll.bill,
      harm: verdict.harm,
      charged: verdict.charged.join("+"),
      attribution: verdict.attribution,
      members: written,
      why: verdict.why,
    });
  }

  // The line takes a name at the third charged vote in the window. Two votes
  // is a caucus; three is a member who keeps showing up on the wrong side. This
  // is the site's standing pattern test, not a Congress-only exception.
  const promoted: string[] = [];
  try {
    const rows = await db
      .prepare(
        `SELECT person, COUNT(*) AS n FROM ledger_entries
          WHERE case_id LIKE 'vote:%'
          GROUP BY lower(person)
         HAVING n >= 3`,
      )
      .all<{ results?: Array<{ person: string; n: number }> }>();
    // The line is the current record, not the archive. The three votes have to
    // be inside the window: a member with two this year and one in 2023 has a
    // history, not a standing, and a history belongs on their page.
    const summaries = await readLedgerSummaries();
    for (const row of rows.results ?? []) {
      const name = String(row.person);
      if ((ledgerSummaryFor(summaries, name)?.windowActs ?? 0) < 3) continue;
      const queued = await ensurePerson(
        db,
        name,
        "Representative, U.S. House",
        "United States",
        "Three or more recorded votes filed as harm inside the last 180 days.",
        "",
      );
      if (queued) promoted.push(name);
    }
  } catch {
    /* queue promotion is a convenience; the ledger is the record */
  }

  if (promoted.length > 0) {
    try {
      const summaries = await readLedgerSummaries();
      for (const name of promoted) {
        const score = ledgerSummaryFor(summaries, name)?.evidence ?? 0;
        await db
          .prepare("UPDATE queue_people SET score = ? WHERE slug = ?")
          .bind(score, slugify(name))
          .run();
      }
    } catch {
      /* the next research pass recomputes it */
    }
  }

  return Response.json({
    ok: true,
    rolls: rolls.length,
    members: members.size,
    filed,
    promoted: promoted.length,
    report,
  });
}
