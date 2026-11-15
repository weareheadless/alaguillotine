import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { UK_COMMONS_BODY } from "@/lib/register/sectors";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/uk-committees — store what each MP oversees.
 *
 * The Commons publishes its committees through the Committees API: 56 current
 * select committees (including bill and procedural committees) and a current
 * membership list per committee carrying the MNIS id, party and constituency.
 * That id is the same one the Register of Members' Financial Interests uses, so
 * a seat joins to an interest without matching names.
 *
 * Every select committee is stored, not only the ones with a jurisdiction rule.
 * A seat is a fact whether or not we have an argument about what it covers. The
 * rule that turns a seat and an interest into a lead lives in
 * `register/sectors.ts`, scoped to this body, and is printed with every lead.
 *
 * Sub-committees are committees of their own here, with a parent id. They are
 * stored with `parent_code`, and the lead lookup falls back to the parent's
 * rule: a seat on the Treasury Sub-Committee on Financial Services Regulations
 * is still a seat overseeing financial services.
 *
 * `?offset=` and `?limit=` exist because 56 committees is 56 membership calls.
 * A run with `nextOffset: null` is a complete pass and replaces the body's whole
 * assignment set; a partial run only upserts.
 */

const COMMITTEES = "https://committees-api.parliament.uk/api/Committees";
const UA = "AdaGuillotine/1.0 (register uk committees)";
const BATCH = 50;
const PARLIAMENT = 59;
const PAGE = 100;
const CONCURRENCY = 5;

interface UkCommittee {
  id: string;
  name: string;
  category: string;
  parentId: string;
}

interface Seat {
  mnis: string;
  name: string;
  party: string;
  constituency: string;
  leadership: string;
  committee: string;
}

function hashId(id: number | string): string {
  return `uk-${id}`;
}

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
}

async function fetchCommittees(): Promise<UkCommittee[]> {
  const url =
    `${COMMITTEES}?House=Commons&CommitteeStatus=Current` +
    `&CommitteeCategory=Select&Take=200&ShowOnWebsiteOnly=true`;
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`committees ${response.status}`);
  const body = (await response.json()) as {
    items?: Array<Record<string, unknown>>;
  };
  const rows: UkCommittee[] = [];
  for (const item of body.items ?? []) {
    const id = String(item.id ?? "");
    if (!id) continue;
    const category = item.category as Record<string, unknown> | undefined;
    const parent = item.parentCommittee as Record<string, unknown> | undefined;
    rows.push({
      id,
      name: String(item.name ?? "").trim(),
      category: String(category?.name ?? "Select"),
      parentId: parent?.id ? String(parent.id) : "",
    });
  }
  return rows.sort((a, b) => Number(a.id) - Number(b.id));
}

async function fetchSeats(committeeId: string): Promise<Seat[]> {
  const seats: Seat[] = [];
  for (let skip = 0; skip < 500; skip += PAGE) {
    const url =
      `${COMMITTEES}/${committeeId}/Members?MembershipStatus=Current` +
      `&Take=${PAGE}&Skip=${skip}&ShowOnWebsiteOnly=true`;
    const response = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`members ${committeeId} ${response.status}`);
    const body = (await response.json()) as {
      items?: Array<Record<string, unknown>>;
      totalResults?: number;
    };
    const items = body.items ?? [];
    for (const item of items) {
      const info = (item.memberInfo ?? {}) as Record<string, unknown>;
      const mnis = String(info.mnisId ?? "").trim();
      if (!mnis) continue; // lay members and witnesses have no seat to join
      const roles = (item.roles ?? []) as Array<Record<string, unknown>>;
      const current = roles.filter((role) => !role.endDate);
      const chair = current.some(
        (role) => (role.role as Record<string, unknown> | undefined)?.isChair === true,
      );
      seats.push({
        mnis,
        name: String(info.displayAs ?? info.listAs ?? "").trim(),
        party: String(info.party ?? "").trim(),
        constituency: String(info.memberFrom ?? "").trim(),
        leadership: chair ? "Chair" : "",
        committee: hashId(committeeId),
      });
    }
    if (items.length < PAGE || seats.length >= Number(body.totalResults ?? 0)) break;
  }
  return seats;
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
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.max(1, Math.min(120, Number(url.searchParams.get("limit") ?? 120) || 120));

  let committees: UkCommittee[];
  try {
    committees = await fetchCommittees();
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }

  const now = new Date().toISOString();
  const before = committees;

  // The body's committee list is small and fully published in one response, so
  // it is replaced as a whole on every run that starts at zero.
  if (offset === 0) {
    await db.prepare("DELETE FROM committees WHERE body_key = ?").bind(UK_COMMONS_BODY).run();
  }
  const committeeWrites = before.map((committee) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO committees
           (code, name, kind, body_key, parent_code, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        hashId(committee.id),
        committee.name,
        committee.category.toLowerCase() || "select",
        UK_COMMONS_BODY,
        committee.parentId ? hashId(committee.parentId) : "",
        now,
      ),
  );
  await batchWrite(db, committeeWrites);

  const known = await db
    .prepare(
      `SELECT id, json_extract(external_ids, '$.mnis') AS mnis
         FROM entities
        WHERE kind = 'person' AND json_extract(external_ids, '$.mnis') IS NOT NULL`,
    )
    .all();
  const byMnis = new Map<string, string>();
  for (const row of known.results ?? []) {
    const mnis = String(row.mnis ?? "").trim();
    if (mnis) byMnis.set(mnis, String(row.id));
  }

  const selected = before.slice(offset, offset + limit);
  const complete = offset + selected.length >= before.length;

  // Resolve seats before writing, so a member is deleted and rewritten once
  // with every committee they sit on in this slice rather than once per call.
  const byPerson = new Map<string, Seat[]>();
  const errors: string[] = [];
  for (let at = 0; at < selected.length; at += CONCURRENCY) {
    const chunk = selected.slice(at, at + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (committee) => ({ committee, seats: await fetchSeats(committee.id) })),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason));
        continue;
      }
      const { committee, seats } = result.value;
      for (const seat of seats) {
        const entityId = byMnis.get(seat.mnis);
        if (!entityId) {
          errors.push(`no entity for MNIS ${seat.mnis} (${seat.name})`);
          continue;
        }
        byPerson.set(entityId, [...(byPerson.get(entityId) ?? []), seat]);
      }
    }
  }

  const writes: ReturnType<D1["prepare"]>[] = [];
  if (complete) {
    // A full pass replaces the body's seats, so a member who left a committee
    // stops carrying the old seat.
    writes.push(
      db.prepare("DELETE FROM committee_assignments WHERE body_key = ?").bind(UK_COMMONS_BODY),
    );
  } else {
    for (const entityId of byPerson.keys()) {
      writes.push(
        db
          .prepare("DELETE FROM committee_assignments WHERE entity_id = ? AND body_key = ?")
          .bind(entityId, UK_COMMONS_BODY),
      );
    }
  }

  let assignments = 0;
  for (const [entityId, seats] of byPerson) {
    for (const seat of seats) {
      const committee = before.find((entry) => hashId(entry.id) === seat.committee);
      if (!committee) continue;
      writes.push(
        db
          .prepare(
            `INSERT OR REPLACE INTO committee_assignments
               (entity_id, committee_code, committee_name, subcommittee_code,
                subcommittee_name, rank, leadership, congress, body_key, updated_at)
             VALUES (?, ?, ?, '', '', '', ?, ?, ?, ?)`,
          )
          .bind(
            entityId,
            hashId(committee.id),
            committee.name,
            seat.leadership,
            PARLIAMENT,
            UK_COMMONS_BODY,
            now,
          ),
      );
      assignments += 1;
    }
  }

  await batchWrite(db, writes);

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('uk-committees', ?, ?, ?, ?)",
      )
      .bind(now, new Date().toISOString(), assignments, errors.length ? errors.slice(0, 3).join("; ") : null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json(
    {
      ok: true,
      parliament: PARLIAMENT,
      committees: before.length,
      offset,
      selected: selected.length,
      complete,
      nextOffset: complete ? null : offset + selected.length,
      members: byPerson.size,
      assignments,
      errors: errors.length,
      errorSample: errors.slice(0, 5),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
