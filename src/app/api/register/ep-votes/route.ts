import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { recomputeUniverseStatus } from "@/lib/register/coverage-status";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/ep-votes — read the European Parliament's roll calls.
 *
 * The Parliament publishes one XML file per sitting day: every roll-call vote,
 * every member, the vote they cast, and the political group they cast it in.
 * It is the same shape as the House Clerk's file, which is why the second body
 * needs a connector rather than a new model.
 *
 * A vote is a document, not a finding. The claim says only "recorded FOR on this
 * vote on this date", the passage is the exact line in the transcript, and the
 * three coverage numbers treat it exactly as they treat a House vote: it makes
 * a member *read*, never *documented* and never *accused*.
 *
 * The transcript is generated mechanically from the official XML and stored
 * with the document, so every claim can be checked as a substring. The source
 * URL is the Parliament's XML, not our rendering. Names and person ids are the
 * Parliament's; nothing is inferred from a surname.
 */

const LIST = "https://data.europarl.europa.eu/api/v2/meetings";
const RCV = "https://data.europarl.europa.eu/distribution/doc";
const UA = "AdaGuillotine/1.0 (register european parliament votes)";
const BATCH = 60;

function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  return (async () => {
    for (let i = 0; i < statements.length; i += BATCH) {
      const chunk = statements.slice(i, i + BATCH);
      if (db.batch) await db.batch(chunk);
      else for (const statement of chunk) await statement.run();
    }
  })();
}

function decode(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const point =
        code[1] === "x" || code[1] === "X"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return named[code.toLowerCase()] ?? match;
  });
}

function hashOf(value: string): Promise<string> {
  return crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(value))
    .then((digest) =>
      [...new Uint8Array(digest)]
        .slice(0, 16)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
}

interface MemberVote {
  vote: "FOR" | "AGAINST" | "ABSTENTION";
  name: string;
  persId: string;
  group: string;
}

interface RollCall {
  id: string;
  date: string;
  title: string;
  votes: MemberVote[];
}

const SECTIONS: Array<[MemberVote["vote"], string]> = [
  ["FOR", "Result.For"],
  ["AGAINST", "Result.Against"],
  ["ABSTENTION", "Result.Abstention"],
];

/** Parse the Parliament's RCV XML into one record per roll-call vote. */
function parseRollCalls(xml: string): RollCall[] {
  const out: RollCall[] = [];
  const blocks = xml.matchAll(
    /<RollCallVote\.Result\b([^>]*)>([\s\S]*?)<\/RollCallVote\.Result>/g,
  );
  for (const block of blocks) {
    const attrs = block[1];
    const body = block[2];
    const id = /Identifier="(\d+)"/.exec(attrs)?.[1] ?? "";
    if (!id) continue;
    const date = (/Date="([^"]*)"/.exec(attrs)?.[1] ?? "").slice(0, 10);
    const title = decode(
      /<RollCallVote\.Description\.Text>([\s\S]*?)<\/RollCallVote\.Description\.Text>/.exec(
        body,
      )?.[1] ?? "",
    ).replace(/\s+/g, " ").trim();

    const votes: MemberVote[] = [];
    for (const [vote, tag] of SECTIONS) {
      const section = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(body)?.[1];
      if (!section) continue;
      const groups = section.matchAll(
        /<Result\.PoliticalGroup\.List\s+Identifier="([^"]+)">([\s\S]*?)<\/Result\.PoliticalGroup\.List>/g,
      );
      for (const group of groups) {
        const groupCode = decode(group[1]);
        const members = group[2].matchAll(
          /<PoliticalGroup\.Member\.Name\s+MepId="[^"]*"\s+PersId="([^"]*)">([\s\S]*?)<\/PoliticalGroup\.Member\.Name>/g,
        );
        for (const member of members) {
          const persId = member[1];
          const name = decode(member[2]).replace(/\s+/g, " ").trim();
          if (!persId || !name) continue;
          votes.push({ vote, name, persId, group: groupCode });
        }
      }
    }
    if (!votes.length) continue;
    out.push({ id, date, title, votes });
  }
  return out;
}

function transcriptFor(roll: RollCall): string {
  const counts = SECTIONS.map(
    ([vote]) => `${vote} ${roll.votes.filter((entry) => entry.vote === vote).length}`,
  ).join(" · ");
  const lines = roll.votes.map(
    (entry) => `${entry.vote} — ${entry.name} (PersId ${entry.persId}, ${entry.group})`,
  );
  return [
    `Roll call ${roll.id} — ${roll.title || "untitled"}`,
    `${roll.date || "unknown date"} · ${counts}`,
    "",
    ...lines,
    "",
  ].join("\n");
}

async function sittingDates(today: string): Promise<string[]> {
  const year = today.slice(0, 4);
  const response = await fetch(`${LIST}?year=${year}&limit=100`, {
    headers: { "user-agent": UA, accept: "application/ld+json" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
  const dates = (body.data ?? [])
    .map((row) => String(row.activity_date ?? ""))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today);
  return [...new Set(dates)].sort().reverse();
}

async function fetchRcv(date: string): Promise<string | null> {
  const url = `${RCV}/PV-10-${date}-RCV_en.xml`;
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*" },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) return null;
  const text = await response.text();
  return text.includes("<RollCallVote.Result") ? text : null;
}

export async function POST(request: Request) {
  const context = (await getCloudflareContext({ async: true })) as { env?: Env };
  const secret = context.env?.CRON_SECRET;
  const cron =
    Boolean(secret) && (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
  if (!cron && !(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(12, Number(url.searchParams.get("limit") ?? 4) || 4));
  const explicitDate = (url.searchParams.get("date") ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);

  const dates = explicitDate ? [explicitDate] : await sittingDates(today);
  let xml: string | null = null;
  let date = "";
  let sourceUrl = "";
  for (const candidate of dates.slice(0, 8)) {
    xml = await fetchRcv(candidate);
    if (xml) {
      date = candidate;
      sourceUrl = `${RCV}/PV-10-${candidate}-RCV_en.xml`;
      break;
    }
  }
  if (!xml) {
    return Response.json(
      { error: "no roll-call file found for recent sittings", tried: dates.slice(0, 8) },
      { status: 502 },
    );
  }

  const rolls = parseRollCalls(xml);
  const known = await db
    .prepare("SELECT id, parsed_at FROM documents WHERE id LIKE 'doc:ep:rcv:%'")
    .all();
  const complete = new Set(
    (known.results ?? [])
      .filter((row) => String(row.parsed_at ?? "") !== "")
      .map((row) => String(row.id ?? "")),
  );

  const selected = rolls
    .filter((roll) => !complete.has(`doc:ep:rcv:${roll.id}`))
    .slice(0, limit);

  const tally = {
    date,
    rolls: rolls.length,
    selected: selected.length,
    claims: 0,
    claimsWithoutEntity: 0,
    documents: 0,
  };
  const now = new Date().toISOString();

  // One lookup for every identity we already hold, instead of one per vote row.
  const knownEntities = await db
    .prepare("SELECT id FROM entities WHERE id LIKE 'person:ep-%'")
    .all();
  const entityIds = new Set(
    (knownEntities.results ?? []).map((row) => String(row.id ?? "")).filter(Boolean),
  );

  for (const roll of selected) {
    const docId = `doc:ep:rcv:${roll.id}`;
    const transcript = transcriptFor(roll);
    const contentHash = await hashOf(transcript);
    const docUrl = `${sourceUrl}#${roll.id}`;

    await db
      .prepare(
        `INSERT INTO documents
           (id, kind, issuer, title, number, url, published_at, retrieved_at,
            content_hash, locator, provenance, text_excerpt, fetched_at, http_status, parsed_at)
         VALUES (?, 'roll_call', 'European Parliament', ?, ?, ?, ?, ?, ?, ?, 'European Parliament, RCV XML; transcript rendered mechanically', ?, ?, 200, '')
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           published_at = excluded.published_at,
           retrieved_at = excluded.retrieved_at,
           content_hash = excluded.content_hash,
           text_excerpt = excluded.text_excerpt,
           parsed_at = ''`,
      )
      .bind(
        docId,
        roll.title,
        roll.id,
        docUrl,
        roll.date,
        now,
        contentHash,
        `roll call ${roll.id}`,
        transcript,
        now,
      )
      .run();

    // Replace any rows from an earlier partial run before writing this one.
    const previous = await db
      .prepare("SELECT claim_id FROM claim_documents WHERE document_id = ?")
      .bind(docId)
      .all();
    const stale = (previous.results ?? []).map((row) => String(row.claim_id ?? "")).filter(Boolean);
    for (const claimId of stale) {
      await db.prepare("DELETE FROM claim_entities WHERE claim_id = ?").bind(claimId).run();
      await db.prepare("DELETE FROM claim_documents WHERE claim_id = ?").bind(claimId).run();
      await db.prepare("DELETE FROM claims WHERE id = ?").bind(claimId).run();
    }

    const legislation = (roll.title.split(/\s+[–-]\s+/)[0] ?? "").trim();
    await db
      .prepare(
        `INSERT OR REPLACE INTO roll_calls
           (document_id, congress, session, chamber, roll, legislation, question,
            kind, result, action_date, description, parsed_at)
         VALUES (?, 0, '10', 'European Parliament', ?, ?, 'roll call', 'ROLLCALL', '', ?, ?, ?)`,
      )
      .bind(docId, Number(roll.id) || 0, legislation, roll.date, roll.title, now)
      .run();

    const writes: ReturnType<D1["prepare"]>[] = [];
    for (const entry of roll.votes) {
      const entityId = `person:ep-${entry.persId}`;
      if (!entityIds.has(entityId)) {
        // A voter who has left the current list is still a person the official
        // record names. Create the identity from the Parliament's own id and
        // name; do not add them to the current-term population.
        writes.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO entities
                 (id, kind, name, slug, country, affiliation, role, external_ids, created_at, updated_at)
               VALUES (?, 'person', ?, ?, '', ?, 'MEP', ?, ?, ?)`,
            )
            .bind(
              entityId,
              entry.name,
              `ep-${entry.persId}`,
              entry.group,
              JSON.stringify({ europarl: entry.persId }),
              now,
              now,
            ),
        );
        entityIds.add(entityId);
        tally.claimsWithoutEntity += 1;
      }

      const act = `Voted ${entry.vote} — ${roll.title || `roll call ${roll.id}`} — roll call ${roll.id}, ${roll.date}.`;
      const claimId = `claim:ep-${entry.persId}:vote:${roll.id}`;
      const quote = `${entry.vote} — ${entry.name} (PersId ${entry.persId}, ${entry.group})`;
      writes.push(
        db
          .prepare(
            `INSERT OR REPLACE INTO claims
               (id, entity_id, act, category, mechanism, beneficiary, act_date,
                date_precision, amount, currency, confidence, confidence_basis,
                status, claim_key, created_at, updated_at)
             VALUES (?, ?, ?, 'vote', '', '', ?, 'day', NULL, '', 0.95, ?, 'recorded', ?, ?, ?)`,
          )
          .bind(
            claimId,
            entityId,
            act,
            roll.date || null,
            `European Parliament roll call ${roll.id}, ${roll.date}: recorded ${entry.vote}`,
            `${entityId}|${act.toLowerCase()}|${roll.date}`,
            now,
            now,
          ),
        db
          .prepare(
            `INSERT OR REPLACE INTO claim_documents
               (claim_id, document_id, quote, locator, stance)
             VALUES (?, ?, ?, ?, 'records')`,
          )
          .bind(claimId, docId, quote, `roll call ${roll.id} · ${entry.vote}`),
        db
          .prepare(
            `INSERT OR REPLACE INTO claim_entities (claim_id, entity_id, role)
             VALUES (?, ?, 'actor')`,
          )
          .bind(claimId, entityId),
      );
      tally.claims += 1;
    }

    await batchWrite(db, writes);
    await db
      .prepare("UPDATE documents SET parsed_at = ? WHERE id = ?")
      .bind(now, docId)
      .run();
    tally.documents += 1;
  }

  if (tally.documents > 0) {
    await recomputeUniverseStatus(db, "ep-10");
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('ep-votes', ?, ?, ?, ?)",
      )
      .bind(now, new Date().toISOString(), tally.claims, null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json({ ok: true, ...tally }, { headers: { "Cache-Control": "no-store" } });
}
