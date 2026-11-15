import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { recomputeUniverseStatus } from "@/lib/register/coverage-status";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/universe — declare the House, and count against it.
 *
 * The Clerk's MemberData.xml is the roster: 435 seats, each with a bioguide id,
 * a party, a state and a district. Declaring it is what turns "we cover a lot
 * of people" into a ratio with a denominator written down before the counting.
 *
 * Coverage here is deliberately not "has a vote". A roll call is a fact about
 * the chamber; 406 members have one. What the register is for is documentation
 * of conduct, so `covered` means: at least one claim whose passage is stored,
 * from a document that is not a roll call. A member with nothing but votes is
 * `listed`, because a vote is not evidence of anything on its own.
 *
 * Entities are matched by bioguide, then by exact name, then by surname and
 * first name among people who have no bioguide yet. Anything else is created,
 * and a name that could be two people goes to entity_review rather than being
 * merged on a guess.
 */

const ROSTER = "https://clerk.house.gov/xml/lists/MemberData.xml";
const UA = "AdaGuillotine/1.0 (register universe)";
const TERRITORIES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);
const BATCH = 60;

interface Member {
  bioguide: string;
  name: string;
  first: string;
  last: string;
  party: string;
  state: string;
  district: string;
  voting: boolean;
}

interface Entity {
  id: string;
  kind: string;
  name: string;
  slug: string;
  bioguide: string;
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return match ? match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseRoster(xml: string): Member[] {
  const out: Member[] = [];
  for (const block of xml.match(/<member>[\s\S]*?<\/member>/g) ?? []) {
    const bioguide = tag(block, "bioguideID").toUpperCase();
    if (!bioguide) continue;
    const state = (/postal-code="([A-Z]{2})"/.exec(block) ?? [])[1] ?? "";
    const district = tag(block, "district");
    out.push({
      bioguide,
      name: tag(block, "official-name") || tag(block, "namelist").replace(",", ""),
      first: tag(block, "firstname"),
      last: tag(block, "lastname"),
      party: tag(block, "party"),
      state,
      district,
      voting: !TERRITORIES.has(state) && !/delegate|commissioner/i.test(district),
    });
  }
  return out;
}

function firstName(name: string): string {
  return (name.replace(/^Hon\.\s+/i, "").trim().split(/\s+/)[0] ?? "").toLowerCase();
}

function surname(name: string): string {
  const parts = name
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
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

  const started = new Date().toISOString();

  let xml = "";
  try {
    const res = await fetch(ROSTER, {
      headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`roster ${res.status}`);
    xml = await res.text();
  } catch (error) {
    return Response.json({ error: `roster unavailable: ${String(error)}` }, { status: 502 });
  }

  const members = parseRoster(xml);
  if (members.length < 400) {
    return Response.json(
      { error: `roster parsed to ${members.length} members; refusing to declare` },
      { status: 502 },
    );
  }

  const voting = members.filter((m) => m.voting);
  const delegates = members.filter((m) => !m.voting);

  // Every person we already know, once, so matching costs no queries.
  const known = await db
    .prepare("SELECT id, kind, name, slug, COALESCE(json_extract(external_ids, '$.bioguide'), '') AS bioguide FROM entities WHERE kind = 'person'")
    .all();
  const entities = ((known.results ?? []) as unknown as Entity[]).map((e) => ({
    ...e,
    bioguide: String(e.bioguide ?? ""),
  }));

  const byBioguide = new Map(entities.filter((e) => e.bioguide).map((e) => [e.bioguide, e]));
  const byName = new Map(entities.map((e) => [e.name.toLowerCase(), e]));
  const bySlug = new Set(entities.map((e) => e.slug));
  const unbioguided = entities.filter((e) => !e.bioguide);

  const writes: ReturnType<D1["prepare"]>[] = [];
  const memberships: Array<{ entityId: string; name: string }> = [];
  const tally = { byBioguide: 0, byName: 0, byPerson: 0, created: 0, ambiguous: 0 };

  const stamp = new Date().toISOString();

  for (const member of voting) {
    let entity = byBioguide.get(member.bioguide) ?? byName.get(member.name.toLowerCase());

    if (!entity) {
      // Surname plus first name, among people with no id yet. Two candidates is
      // not a match; it is a question, and it goes to the review queue.
      const last = surname(member.name);
      const first = firstName(member.name);
      const candidates = unbioguided.filter(
        (e) => surname(e.name) === last && firstName(e.name) === first,
      );
      if (candidates.length > 1) {
        tally.ambiguous += 1;
        writes.push(
          db
            .prepare(
              "INSERT INTO entity_review (name, reason, source, candidates, created_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(
              member.name,
              "roster name matches more than one person",
              ROSTER,
              JSON.stringify(candidates.map((c) => ({ id: c.id, name: c.name }))),
              stamp,
            ),
        );
        continue;
      }
      if (candidates.length === 1) {
        entity = candidates[0];
        // Remove from the pool so the next member cannot claim the same person.
        unbioguided.splice(unbioguided.indexOf(candidates[0]), 1);
        tally.byPerson += 1;
      }
    } else {
      if (byBioguide.has(member.bioguide)) tally.byBioguide += 1;
      else tally.byName += 1;
    }

    if (!entity) {
      const base = slugify(member.name) || member.bioguide.toLowerCase();
      let slug = base;
      let n = 2;
      while (bySlug.has(slug)) slug = `${base}-${n++}`;
      bySlug.add(slug);
      const id = `person:${slug}`;
      entity = { id, kind: "person", name: member.name, slug, bioguide: member.bioguide };
      entities.push(entity);
      byBioguide.set(member.bioguide, entity);
      byName.set(member.name.toLowerCase(), entity);
      tally.created += 1;
      writes.push(
        db
          .prepare(
            `INSERT INTO entities
               (id, kind, name, slug, aliases, country, affiliation, role,
                external_ids, state, district, created_at, updated_at)
             VALUES (?, 'person', ?, ?, '[]', 'US', ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            member.name,
            slug,
            member.party,
            `US Representative (${member.state}-${member.district})`,
            JSON.stringify({ bioguide: member.bioguide }),
            member.state,
            member.district,
            stamp,
            stamp,
          ),
      );
    } else {
      // The roster is the authority on party, seat and identity; keep it current
      // without overwriting whatever else the entity has accumulated.
      if (!entity.bioguide) byBioguide.set(member.bioguide, entity);
      entity.bioguide = member.bioguide;
      writes.push(
        db
          .prepare(
            `UPDATE entities
                SET affiliation = ?, role = ?, state = ?, district = ?,
                    external_ids = json_set(external_ids, '$.bioguide', ?),
                    updated_at = ?
              WHERE id = ?`,
          )
          .bind(
            member.party,
            `US Representative (${member.state}-${member.district})`,
            member.state,
            member.district,
            member.bioguide,
            stamp,
            entity.id,
          ),
      );
    }

    memberships.push({ entityId: entity.id, name: member.name });
  }

  // The declaration itself. 435 seats is the definition, not a count of rows.
  writes.push(
    db
      .prepare(
        `INSERT OR REPLACE INTO universes
           (id, name, description, definition, source_url, declared_at, expected,
            country, body, body_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'US', 'House of Representatives', 'US-House')`,
      )
      .bind(
        "house-119",
        "The House, 119th Congress",
        `${voting.length} members listed on the Clerk's roster on ${stamp.slice(0, 10)}; ${delegates.length} non-voting delegates are outside the population. ${435 - voting.length} seats vacant or unfilled at declaration.`,
        "Every voting seat in the House of Representatives, enumerated from the Clerk's MemberData.xml, matched to an entity by bioguide id.",
        ROSTER,
        stamp,
        435,
      ),
  );

  for (const member of memberships) {
    writes.push(
      db
        .prepare(
          "INSERT OR REPLACE INTO universe_members (universe_id, entity_id, status, note) VALUES ('house-119', ?, 'listed', '')",
        )
        .bind(member.entityId),
    );
  }

  await batchWrite(db, writes);

  // Coverage, computed from the record and not from memory. A vote makes a
  // member read. A passage about an act — a trade, a filing, a story — makes
  // them documented. A passage about a misdeed makes them accused. Three
  // numbers, because one number let 90 trade filings look like 90 findings.
  await recomputeUniverseStatus(db, "house-119");

  const coverage = await db
    .prepare(
      "SELECT expected, listed, read, documented, accused FROM coverage WHERE universe_id = 'house-119'",
    )
    .first<{ expected: number; listed: number; read: number; documented: number; accused: number }>();

  const voted = await db
    .prepare(
      `SELECT COUNT(DISTINCT m.entity_id) AS n
         FROM universe_members m
         JOIN claims c ON c.entity_id = m.entity_id AND c.status = 'recorded'
        WHERE m.universe_id = 'house-119'`,
    )
    .first<{ n: number }>();

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('universe', ?, ?, ?, ?)",
      )
      .bind(started, new Date().toISOString(), memberships.length, null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json(
    {
      ok: true,
      declared: "house-119",
      roster: { members: members.length, voting: voting.length, delegates: delegates.length },
      matched: tally,
      expected: Number(coverage?.expected ?? 435),
      listed: Number(coverage?.listed ?? 0),
      read: Number(coverage?.read ?? 0),
      documented: Number(coverage?.documented ?? 0),
      accused: Number(coverage?.accused ?? 0),
      withRecordedVote: Number(voted?.n ?? 0),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
