import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { HOUSE_BODY, UK_COMMONS_BODY } from "@/lib/register/sectors";
import { readEntityLeads } from "@/lib/register/leads";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/committees — store what each member oversees.
 * GET  /api/register/committees?entity=<bioguide|slug|name> — assignments, and
 *      the trades that touch their committees' jurisdiction.
 *
 * Assignments are the Clerk's roster, by committee code. The matching itself is
 * a written rule (`register/sectors.ts`) applied to an asset name, and every
 * lead it produces is printed with the rule that produced it. That is the whole
 * difference between this and a hunch: two citations and a published argument,
 * not a vibe about a stock.
 *
 * A lead is not a finding. A member on Armed Services buying a defence
 * contractor is legal, common, and often disclosed in a blind trust; what the
 * register can say is that the two facts are both on the record.
 */

const ROSTER = "https://clerk.house.gov/xml/lists/MemberData.xml";
const UA = "AdaGuillotine/1.0 (register committees)";
const BATCH = 60;

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
  return match ? match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
}

interface Committee {
  code: string;
  name: string;
  kind: string;
  subcommittees: Map<string, string>;
}

function parseCommittees(xml: string): Map<string, Committee> {
  const committees = new Map<string, Committee>();
  const block = /<committee type="([^"]*)" comcode="([^"]+)"[^>]*>([\s\S]*?)<\/committee>/g;
  let match: RegExpExecArray | null;
  while ((match = block.exec(xml))) {
    const committee: Committee = {
      code: match[2],
      kind: match[1],
      name: tag(match[3], "committee-fullname"),
      subcommittees: new Map(),
    };
    for (const sub of match[3].matchAll(
      /<subcommittee subcomcode="([^"]+)"[^>]*>([\s\S]*?)<\/subcommittee>/g,
    )) {
      committee.subcommittees.set(sub[1], tag(sub[2], "subcommittee-fullname"));
    }
    committees.set(committee.code, committee);
  }
  return committees;
}

function parseAssignments(
  block: string,
  committees: Map<string, Committee>,
): Array<{ committee: string; subcommittee: string; rank: string; leadership: string }> {
  const rows: Array<{ committee: string; subcommittee: string; rank: string; leadership: string }> = [];
  const parentOfSub = new Map<string, string>();
  for (const committee of committees.values()) {
    for (const code of committee.subcommittees.keys()) parentOfSub.set(code, committee.code);
  }
  for (const committee of block.matchAll(/<committee comcode="([^"]+)"([^>]*)\/>/g)) {
    const rank = /rank="(\d+)"/.exec(committee[2])?.[1] ?? "";
    rows.push({ committee: committee[1], subcommittee: "", rank, leadership: "" });
  }
  for (const sub of block.matchAll(/<subcommittee subcomcode="([^"]+)"([^>]*)\/>/g)) {
    const parent = parentOfSub.get(sub[1]);
    if (!parent) continue;
    rows.push({
      committee: parent,
      subcommittee: sub[1],
      rank: /rank="(\d+)"/.exec(sub[2])?.[1] ?? "",
      leadership: /leadership="([^"]*)"/.exec(sub[2])?.[1] ?? "",
    });
  }
  return rows;
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

  let xml = "";
  try {
    const response = await fetch(ROSTER, {
      headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`roster ${response.status}`);
    xml = await response.text();
  } catch (error) {
    return Response.json({ error: `roster unavailable: ${String(error)}` }, { status: 502 });
  }

  const congress = Number(/<congress-num>(\d+)<\/congress-num>/.exec(xml)?.[1] ?? 0);
  const committees = parseCommittees(xml);
  const now = new Date().toISOString();

  const members = xml.match(/<member>[\s\S]*?<\/member>/g) ?? [];
  const byBioguide = new Map<string, string>();
  const known = await db
    .prepare(
      `SELECT id, json_extract(external_ids, '$.bioguide') AS bioguide FROM entities WHERE kind = 'person'`,
    )
    .all();
  for (const row of known.results ?? []) {
    if (row.bioguide) byBioguide.set(String(row.bioguide), String(row.id));
  }

  const writes: ReturnType<D1["prepare"]>[] = [];
  for (const committee of committees.values()) {
    writes.push(
      db
        .prepare(
          "INSERT OR REPLACE INTO committees (code, name, kind, body_key, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(committee.code, committee.name, committee.kind, HOUSE_BODY, now),
    );
  }

  let membersWritten = 0;
  let assignments = 0;
  for (const member of members) {
    const bioguide = tag(member, "bioguideID").toUpperCase();
    const entityId = byBioguide.get(bioguide);
    if (!entityId) continue;
    const block = /<committee-assignments>([\s\S]*?)<\/committee-assignments>/.exec(member)?.[1];
    if (!block) continue;

    const rows = parseAssignments(block, committees);
    writes.push(db.prepare("DELETE FROM committee_assignments WHERE entity_id = ?").bind(entityId));
    for (const row of rows) {
      const committee = committees.get(row.committee);
      writes.push(
        db
          .prepare(
            `INSERT OR REPLACE INTO committee_assignments
               (entity_id, committee_code, committee_name, subcommittee_code,
                subcommittee_name, rank, leadership, congress, body_key, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            entityId,
            row.committee,
            committee?.name ?? "",
            row.subcommittee,
            row.subcommittee ? committee?.subcommittees.get(row.subcommittee) ?? "" : "",
            row.rank,
            row.leadership,
            congress,
            HOUSE_BODY,
            now,
          ),
      );
      assignments += 1;
    }
    membersWritten += 1;
  }

  await batchWrite(db, writes);

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('committees', ?, ?, ?, ?)",
      )
      .bind(now, new Date().toISOString(), assignments, null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json({
    ok: true,
    congress,
    committees: committees.size,
    members: membersWritten,
    assignments,
  });
}

export async function GET(request: Request) {
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
  const who = (url.searchParams.get("entity") ?? "").trim();
  const body = (url.searchParams.get("body") ?? HOUSE_BODY).trim();
  if (!who) return Response.json({ error: "entity is required" }, { status: 400 });
  if (body !== HOUSE_BODY && body !== UK_COMMONS_BODY) {
    return Response.json({ error: `unknown body ${body}` }, { status: 400 });
  }

  const entity = await db
    .prepare(
      `SELECT id, name, slug, affiliation, state, district
         FROM entities
        WHERE id = ? OR slug = ? OR lower(name) = lower(?)
           OR json_extract(external_ids, '$.bioguide') = ?
           OR json_extract(external_ids, '$.mnis') = ?
        LIMIT 2`,
    )
    .bind(who, who, who, who, who)
    .all();

  const rows = (entity.results ?? []) as unknown as Array<Record<string, unknown>>;
  if (!rows.length) return Response.json({ error: "no such entity", entity: who }, { status: 404 });
  if (rows.length > 1) return Response.json({ error: "ambiguous entity" }, { status: 409 });
  const person = rows[0];

  const report = await readEntityLeads(String(person.id), body);
  if (!report) return Response.json({ error: "D1 unavailable" }, { status: 500 });

  return Response.json(
    {
      ok: true,
      body,
      entity: {
        id: person.id,
        name: person.name,
        party: person.affiliation,
        state: person.state,
        district: person.district,
      },
      assignments: report.assignments,
      leads: report.leads,
      note:
        "A lead is two facts on the record — a committee seat and a disclosed " +
        (body === UK_COMMONS_BODY ? "registered interest" : "trade") +
        " — plus the published rule that the committee oversees that business. It is not a finding.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
