import { getCloudflareContext } from "@opennextjs/cloudflare";
import { clockConfig, type ClockConfig } from "@/lib/clock-research";
import { writeLedgerEntries } from "@/lib/ledger-write";
import { getDb, type D1 } from "@/lib/hate-store";
import { ledgerSummaryFor, readLedgerSummaries } from "@/lib/archive-store";
import {
  billLabel,
  chargeable,
  prettyDate,
  recentRolls,
  type RollCall,
} from "@/lib/rollcalls";
import { slugify } from "@/lib/slug";
import type { LedgerEntry } from "@/lib/backfill";

export const dynamic = "force-dynamic";

/**
 * POST /api/congress/refresh — the roll-call pass.
 *
 * A member of Congress enters the ledger for a vote, never for a donor. The
 * roll call is the record: it carries the bill, the day and the member's own
 * Yea, so the charge does not rest on a reporter's summary or on what anyone
 * assumed from the money.
 *
 * The narrow part is who gets looked at. Only bills about arms, Israel, UNRWA
 * or defence, only the last few dozen rolls, and only members named in the
 * reporting as having voted — from each bill, at most half a dozen. That keeps
 * the line from turning into a roster of four hundred and thirty-five while
 * still finding the people the wire skips.
 *
 * One rule the pass refuses: a Nay on a weapons transfer is not a charge. Only
 * the votes that armed, funded or sustained get filed.
 */

interface Snippet {
  title: string;
  url: string;
  site: string;
  summary: string;
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

const EXTRACT = `You are reading a U.S. House roll call and a handful of snippets about it.

Return two lists.

"voters": members of Congress whose vote on THIS roll call is stated in the snippets. A snippet may be a table or a structured record rather than prose — a row "Name | Yea", or "Member Vote: Yea", or "Rep. Alma Adams, D-N.C., voted yes" all state a vote. Never infer a vote from party, from the bill's supporters, or from a general sentence about "Democrats". If the snippets do not state the member's vote, that member does not exist for this task.

"leads": members named in the snippets as the bill's sponsor, author, or floor manager. Only when a snippet says so in words.

Include source_index: which snippet (0-based) the entry came from. The quote must be the words that name the member, verbatim, max 200 characters. Name is the full name as printed — first name and surname. A snippet that gives only a surname names nobody: omit that entry.

Return JSON only:
{"voters":[{"name":"Full Name","state":"NC","vote":"Yea|Nay|Present|Not Voting","quote":"...","source_index":0}],
 "leads":[{"name":"Full Name","state":"AL","role":"sponsor","quote":"...","source_index":1}]}`;

async function searchReports(config: ClockConfig, roll: RollCall): Promise<Snippet[]> {
  const day = prettyDate(roll.date);
  const queries = [
    `${billLabel(roll.bill)} ${roll.title} House vote ${day}`,
    `${billLabel(roll.bill)} "how they voted" ${day.slice(-4)}`,
  ].map((q) => q.slice(0, 250));

  const out: Snippet[] = [];
  for (const query of queries) {
    try {
      const data = await post<{ results?: Array<Record<string, unknown>> }>(
        `${config.searchBase}/v1/tools/search`,
        { query: `lang:en ${query}`, count: 5, need_content: false },
        config.searchKey,
      );
      for (const r of data.results ?? []) {
        if (!r.url || !r.summary) continue;
        // Campaign tags and anchors make a citation look like spam. Keep the
        // address of the page, not the trail that led to it.
        let url = String(r.url);
        try {
          const parsed = new URL(url);
          url = `${parsed.origin}${parsed.pathname}`;
        } catch {
          /* leave it as given */
        }
        out.push({
          title: String(r.title ?? "").slice(0, 200),
          url,
          site: String(r.site_name ?? ""),
          summary: String(r.summary).slice(0, 700),
        });
      }
    } catch {
      /* one query failing should not lose the other */
    }
  }

  const seen = new Set<string>();
  return out
    .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
    .slice(0, 8);
}

interface Named {
  name: string;
  state: string;
  vote?: string;
  role?: string;
  quote: string;
  source_index?: number;
}

interface Extracted {
  voters: Named[];
  leads: Named[];
  raw?: string;
}

async function extractMembers(
  config: ClockConfig,
  roll: RollCall,
  snippets: Snippet[],
): Promise<Extracted> {
  const data = await post<{ choices?: Array<{ message?: { content?: string } }> }>(
    `${config.chatBase}/chat/completions`,
    {
      model: config.chatModel,
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACT },
        {
          role: "user",
          content: JSON.stringify({
            roll_call: {
              bill: billLabel(roll.bill),
              title: roll.title,
              question: roll.question,
              result: roll.result,
              date: prettyDate(roll.date),
              url: roll.url,
            },
            snippets,
          }),
        },
      ],
    },
    config.chatKey,
  );

  const raw = (data.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  if (!raw) return { voters: [], leads: [], raw: "(empty)" };
  try {
    const parsed = JSON.parse(raw) as Partial<Extracted>;
    return {
      voters: (parsed.voters ?? []).filter((m) => m && m.name && m.vote),
      leads: (parsed.leads ?? []).filter((m) => m && m.name),
      raw,
    };
  } catch {
    return { voters: [], leads: [], raw };
  }
}

const normalVote = (v: string): string => {
  const t = v.trim().toLowerCase();
  if (t === "aye" || t === "yea" || t === "yes") return "Yea";
  if (t === "no" || t === "nay") return "Nay";
  if (t.startsWith("present")) return "Present";
  if (t.startsWith("not voting")) return "Not Voting";
  return v.trim();
};

/**
 * The clerk prints a surname, and appends the state when two members share one:
 * "Rogers (AL)", "Johnson (GA)". Strip the suffix before matching, or a quarter
 * of the House becomes unmatchable.
 */
const surname = (name: string): string => {
  const parts = name
    .replace(/\s*\([A-Z]{2}\)\s*$/i, "")
    .replace(/[.,]/g, "")
    .trim()
    .split(/\s+/);
  return (parts[parts.length - 1] ?? "").toLowerCase();
};

/**
 * The vote must be the member's, on this roll, as the clerk recorded it.
 *
 * Three gates. A full name, because "Jordan" is not a person and the ledger
 * does not file surnames. A quote that contains it, because a snippet which
 * never says the name is not evidence that it named them. And the vote itself,
 * matched against the clerk's own list.
 */
function verify(roll: RollCall, member: Named): { name: string; vote: string } | null {
  const last = surname(member.name);
  if (member.name.trim().split(/\s+/).length < 2) return null;
  if (!member.quote || !member.quote.toLowerCase().includes(last)) return null;

  const matches = roll.votes.filter((v) => surname(v.name) === last);
  const vote = normalVote(member.vote ?? "");

  if (matches.length === 1) {
    return matches[0].vote === vote ? { name: member.name, vote } : null;
  }
  if (matches.length > 1) {
    const state = (member.state ?? "").toUpperCase();
    const exact = matches.find((m) => m.state.toUpperCase() === state);
    return exact && exact.vote === vote ? { name: member.name, vote } : null;
  }
  return null;
}

/**
 * The named lead: the sponsor or floor manager, as a snippet describes them.
 *
 * There is no vote to check, so the gate is tighter in the other direction —
 * the surname must be in the snippet itself, not only in the model's quote, and
 * the person must appear on the roll's membership list. A name invented for the
 * occasion has nowhere to stand.
 */
function verifyLead(
  roll: RollCall,
  member: Named,
  snippets: Snippet[],
): { name: string; role: string; url: string } | null {
  const last = surname(member.name);
  if (!last || member.name.trim().split(/\s+/).length < 2) return null;
  if (!roll.votes.some((v) => surname(v.name) === last)) return null;

  const snippet = snippets[member.source_index ?? -1];
  if (!snippet) return null;
  const text = `${snippet.title} ${snippet.summary}`.toLowerCase();
  if (!text.includes(last)) return null;

  return { name: member.name, role: member.role || "sponsor", url: snippet.url };
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

  // Daily runs read the newest rolls. A cold start — or a first run after a
  // long gap — can ask for the whole evidence window instead, which is what
  // `?deep=1` is for.
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const rolls = await recentRolls(deep ? 180 : 40);
  const armed = rolls.filter(chargeable).slice(0, 2);
  const report: Array<Record<string, unknown>> = [];

  if (armed.length === 0) {
    return Response.json({ ok: true, rolls: rolls.length, bills: 0, added: 0 });
  }

  let added = 0;
  const queued = new Set<string>();

  for (const roll of armed) {
    try {
      const snippets = await searchReports(config, roll);
      if (snippets.length === 0) {
        report.push({ roll: roll.roll, bill: roll.bill, skipped: "no reporting" });
        continue;
      }

      if (url.searchParams.get("debug") === "1") {
        report.push({
          roll: roll.roll,
          snippets: snippets.map((s) => ({
            title: s.title.slice(0, 100),
            site: s.site,
            summary: s.summary.slice(0, 220),
          })),
        });
      }

      const named = await extractMembers(config, roll, snippets);
      const voters = named.voters
        .map((m) => verify(roll, m))
        .filter((m): m is { name: string; vote: string } => m !== null)
        // A Nay on a weapons transfer is a vote against arming, not a charge.
        .filter((m) => m.vote === "Yea")
        .slice(0, 6);

      const leads = named.leads
        .map((m) => verifyLead(roll, m, snippets))
        .filter((m): m is NonNullable<ReturnType<typeof verifyLead>> => m !== null)
        .slice(0, 2);

      report.push({
        roll: roll.roll,
        bill: roll.bill,
        snippets: snippets.length,
        voters: voters.length,
        leads: leads.length,
        raw: url.searchParams.get("debug") === "1" ? named.raw?.slice(0, 400) : undefined,
      });

      const year = Number(roll.date.slice(0, 4));
      const category = /unrwa|refugee|humanitarian|assistance/i.test(roll.title)
        ? "extraction"
        : "arms";

      const entries: Array<{ entry: LedgerEntry; url: string }> = [
        ...voters.map((m) => ({
          url: roll.url,
          entry: {
            person: m.name,
            role: "Representative, U.S. House",
            act: `Voted Yea on ${billLabel(roll.bill)} — "${roll.title}" — roll call ${roll.roll}, ${prettyDate(roll.date)}.`,
            place: "U.S. House of Representatives",
            year,
            category,
            confidence: 75,
            sources: [roll.url],
            caseId: `congress:${roll.roll}:${roll.date}`,
          },
        })),
        ...leads.map((m) => ({
          url: m.url,
          entry: {
            person: m.name,
            role: "Representative, U.S. House",
            act: `Sponsor of ${billLabel(roll.bill)} — "${roll.title}" — which passed the House on ${prettyDate(roll.date)}, roll call ${roll.roll}.`,
            place: "U.S. House of Representatives",
            year,
            category,
            confidence: 65,
            sources: [m.url],
            caseId: `congress-lead:${roll.roll}:${roll.date}`,
          },
        })),
      ];

      for (const { entry, url } of entries) {
        const filed = await writeLedgerEntries(db, entry.person, [entry]);
        const fresh = await ensurePerson(
          db,
          entry.person,
          "Representative, U.S. House",
          "United States",
          entry.act.slice(0, 220),
          url,
        );
        added += filed.added;
        if (filed.added > 0) queued.add(entry.person);
        report.push({
          roll: roll.roll,
          bill: roll.bill,
          person: entry.person,
          added: filed.added,
          queued: fresh,
        });
      }
    } catch (error) {
      report.push({
        roll: roll.roll,
        bill: roll.bill,
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }

  // The queue shows the number the ledger earns. A new name would otherwise
  // sit at zero until the next research pass, which reads as "no record" on a
  // page that has just filed the record.
  if (queued.size > 0) {
    try {
      const summaries = await readLedgerSummaries();
      for (const name of queued) {
        const score = ledgerSummaryFor(summaries, name)?.evidence ?? 0;
        await db
          .prepare("UPDATE queue_people SET score = ? WHERE slug = ?")
          .bind(score, slugify(name))
          .run();
      }
    } catch {
      /* the next research pass recomputes it anyway */
    }
  }

  return Response.json({ ok: true, rolls: rolls.length, bills: armed.length, added, report });
}
