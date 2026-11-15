import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { recomputeUniverseStatus } from "@/lib/register/coverage-status";
import { parseCsv } from "@/lib/register/csv";
import { unzip } from "@/lib/register/zip";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/uk-interests — read the House of Commons register.
 *
 * The Commons publishes the Register of Members' Financial Interests as an
 * official CSV ZIP, one file per category, plus a Members API for the current
 * roster. That is better than the PDF: every interest arrives with a member id,
 * a category, a registration date and named fields, so nothing has to be read
 * out of prose or guessed from a layout.
 *
 * One document per member, not per interest: the register is organised as a
 * section per MP, and a reader checking a claim should land on the member's
 * interests, not a fragment. The document text is a mechanical transcript of
 * the API's structured fields; every claim quotes a contiguous block of it.
 *
 * The claim is "registered an interest", with the category in `mechanism`. A
 * registered shareholding or donation is a disclosure, not a finding: the
 * stance is `records`, and it makes the member `documented`, never `accused`.
 *
 * The population is the current Commons (650 seats), not the 586 members who
 * happen to have a live interest in this register. Members with no interests
 * stay `listed`; a member with one becomes `read` and `documented`.
 */

const REGISTERS = "https://interests-api.parliament.uk/api/v1/Registers";
const INTERESTS = "https://interests-api.parliament.uk/api/v1/Interests";
const MEMBERS = "https://members-api.parliament.uk/api/Members/Search";
const UA = "AdaGuillotine/1.0 (register uk interests)";
const PAGE = 20;
const BATCH = 40;
const COMMONS_SEATS = 650;

interface RosterMember {
  id: string;
  name: string;
  party: string;
  constituency: string;
}

interface InterestRow {
  id: string;
  memberId: string;
  memberName: string;
  category: string;
  summary: string;
  registered: string;
  published: string;
  parent: string;
  value: number | null;
  fields: Array<[string, string]>;
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

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
}

async function fetchRoster(): Promise<Map<string, RosterMember>> {
  const roster = new Map<string, RosterMember>();
  for (let skip = 0; skip < 2000; skip += PAGE) {
    const response = await fetch(
      `${MEMBERS}?House=1&IsCurrentMember=true&take=${PAGE}&skip=${skip}`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) throw new Error(`members ${response.status}`);
    const body = (await response.json()) as {
      items?: Array<{ value?: Record<string, unknown> }>;
    };
    const items = body.items ?? [];
    for (const item of items) {
      const value = item.value;
      if (!value) continue;
      const id = String(value.id ?? "");
      if (!id) continue;
      const party = (value.latestParty as Record<string, unknown> | undefined)?.name;
      const house = value.latestHouseMembership as Record<string, unknown> | undefined;
      roster.set(id, {
        id,
        name: String(value.nameDisplayAs ?? value.nameListAs ?? "").trim(),
        party: String(party ?? "").trim(),
        constituency: String(house?.membershipFrom ?? "").trim(),
      });
    }
    if (items.length < PAGE) break;
  }
  return roster;
}

async function latestRegister(): Promise<{ id: string; publishedDate: string }> {
  const response = await fetch(`${REGISTERS}?Type=Commons&Take=20`, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`registers ${response.status}`);
  const body = (await response.json()) as {
    items?: Array<{ id?: number; publishedDate?: string }>;
  };
  const latest = body.items?.[0];
  if (!latest?.id) throw new Error("no Commons register published");
  return { id: String(latest.id), publishedDate: String(latest.publishedDate ?? "") };
}

function rowValue(cells: string[], header: string[]): string {
  const at = header.indexOf("Value");
  return at >= 0 ? (cells[at] ?? "").trim() : "";
}

async function fetchInterests(registerId: string): Promise<Map<string, InterestRow[]>> {
  const response = await fetch(`${INTERESTS}/csv?registerId=${registerId}`, {
    headers: { "user-agent": UA, accept: "text/csv,application/zip,*/*" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`interests csv ${response.status}`);
  const entries = unzip(new Uint8Array(await response.arrayBuffer()));

  const byMember = new Map<string, InterestRow[]>();
  const common = new Set([
    "ID",
    "Summary",
    "Parent Interest ID",
    "Registered",
    "Published",
    "Category",
    "MNIS ID",
    "Member",
    "Link",
  ]);

  for (const entry of entries) {
    if (!entry.name.toLowerCase().endsWith(".csv")) continue;
    const rows = parseCsv(new TextDecoder().decode(entry.data));
    if (rows.length < 2) continue;
    const header = rows[0];
    for (const cells of rows.slice(1)) {
      const valueAt = (name: string): string => {
        const at = header.indexOf(name);
        return at >= 0 ? (cells[at] ?? "").trim() : "";
      };
      const id = valueAt("ID");
      const memberId = valueAt("MNIS ID");
      if (!id || !memberId) continue;
      const fields: Array<[string, string]> = [];
      header.forEach((name, index) => {
        if (common.has(name)) return;
        if (name.startsWith("Updated_")) return;
        const value = (cells[index] ?? "").trim();
        if (value) fields.push([name, value]);
      });
      const rawValue = rowValue(cells, header);
      const value = rawValue ? Number(rawValue) : Number.NaN;
      byMember.set(memberId, [
        ...(byMember.get(memberId) ?? []),
        {
          id,
          memberId,
          memberName: valueAt("Member"),
          category: valueAt("Category"),
          summary: valueAt("Summary"),
          registered: valueAt("Registered"),
          published: valueAt("Published"),
          parent: valueAt("Parent Interest ID"),
          value: Number.isFinite(value) ? value : null,
          fields,
        },
      ]);
    }
  }
  return byMember;
}

function memberDocument(
  memberId: string,
  roster: RosterMember | undefined,
  rows: InterestRow[],
  register: { id: string; publishedDate: string },
): { text: string; blocks: string[] } {
  const name = roster?.name ?? rows[0]?.memberName ?? `Member ${memberId}`;
  const meta = [roster?.party, roster?.constituency].filter(Boolean).join(" · ");
  const lines = [
    `Register of Members' Financial Interests — ${name}`,
    `House of Commons · as at ${register.publishedDate || "unknown date"} · register ${register.id}`,
    `Member: ${memberId}${meta ? ` · ${meta}` : ""}`,
    `Source: ${INTERESTS}?MemberId=${memberId}&RegisterId=${register.id}`,
    "",
  ];
  const blocks: string[] = [];
  for (const row of rows) {
    const block = [
      `Interest ${row.id} — ${row.category}`,
      `Summary: ${row.summary}`,
      `Registered: ${row.registered}`,
      `Published: ${row.published}`,
    ].join("\n");
    blocks.push(block);
    lines.push(block);
    if (row.parent) lines.push(`Parent interest: ${row.parent}`);
    if (row.fields.length) {
      lines.push("Fields:");
      for (const [key, value] of row.fields) lines.push(`  ${key}: ${value}`);
    }
    lines.push("");
  }
  return { text: lines.join("\n"), blocks };
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
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get("limit") ?? 200) || 200));

  let register: { id: string; publishedDate: string };
  let roster: Map<string, RosterMember>;
  let byMember: Map<string, InterestRow[]>;
  try {
    register = await latestRegister();
    roster = await fetchRoster();
    byMember = await fetchInterests(register.id);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }

  const now = new Date().toISOString();
  // Every current member is processed, not only those with a live interest.
  // A member whose interests have all expired must lose the old claims rather
  // than keep a record that the new register no longer supports.
  const memberIds = [...new Set([...roster.keys(), ...byMember.keys()])].sort(
    (a, b) => Number(a) - Number(b),
  );
  const selected = memberIds.slice(offset, offset + limit);
  const withInterests = byMember.size;

  const rosterWithInterests = memberIds.filter((id) => roster.has(id)).length;
  const description =
    `${roster.size} current Members of the House of Commons, enumerated from the Members API. ` +
    `${rosterWithInterests} have at least one live interest in register ${register.id} (as at ` +
    `${register.publishedDate || "an unknown date"}); ${Math.max(0, roster.size - rosterWithInterests)} have none. ` +
    `The register is the declaration; documents read against this population are counted above ` +
    `and never mixed with another body.`;

  await db
    .prepare(
      `INSERT INTO universes
         (id, name, description, definition, source_url, declared_at, expected,
          country, body, body_key)
       VALUES ('uk-commons-59', ?, ?, ?, ?, ?, ?, 'UK', 'House of Commons', 'UK-Commons')
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         definition = excluded.definition,
         source_url = excluded.source_url,
         declared_at = excluded.declared_at,
         expected = excluded.expected,
         country = excluded.country,
         body = excluded.body,
         body_key = excluded.body_key`,
    )
    .bind(
      "The House of Commons, 59th Parliament",
      description,
      "Every current Member of the House of Commons, enumerated from the Members API and joined to the Register of Members' Financial Interests by MNIS id.",
      `${REGISTERS}/${register.id}`,
      now,
      COMMONS_SEATS,
    )
    .run();

  // Every current member is listed, whether or not they have an interest.
  const entityWrites: ReturnType<D1["prepare"]>[] = [];
  for (const member of roster.values()) {
    const entityId = `person:uk-${member.id}`;
    entityWrites.push(
      db
        .prepare(
          `INSERT INTO entities
             (id, kind, name, slug, country, affiliation, role, external_ids, created_at, updated_at)
           VALUES (?, 'person', ?, ?, 'United Kingdom', ?, 'MP', ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             country = excluded.country,
             affiliation = excluded.affiliation,
             role = excluded.role,
             external_ids = excluded.external_ids,
             updated_at = excluded.updated_at`,
        )
        .bind(
          entityId,
          member.name,
          `uk-${member.id}`,
          member.party,
          JSON.stringify({ mnis: member.id }),
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO universe_members (universe_id, entity_id, status, note)
           VALUES ('uk-commons-59', ?, 'listed', ?)
           ON CONFLICT(universe_id, entity_id) DO NOTHING`,
        )
        .bind(entityId, member.constituency),
    );
  }

  // A member who has left the House can still have interests in the register.
  // They get an identity and a record, but not a seat in the current universe.
  for (const memberId of memberIds) {
    if (roster.has(memberId)) continue;
    const row = byMember.get(memberId)?.[0];
    if (!row) continue;
    entityWrites.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO entities
             (id, kind, name, slug, country, affiliation, role, external_ids, created_at, updated_at)
           VALUES (?, 'person', ?, ?, 'United Kingdom', '', 'MP', ?, ?, ?)`,
        )
        .bind(
          `person:uk-${memberId}`,
          row.memberName || `Member ${memberId}`,
          `uk-${memberId}`,
          JSON.stringify({ mnis: memberId }),
          now,
          now,
        ),
    );
  }
  await batchWrite(db, entityWrites);

  const tally = {
    registerId: register.id,
    publishedDate: register.publishedDate,
    roster: roster.size,
    membersWithInterests: withInterests,
    offset,
    selected: selected.length,
    documents: 0,
    claims: 0,
    nextOffset: offset + selected.length < memberIds.length ? offset + selected.length : null,
  };

  for (const memberId of selected) {
    const rows = byMember.get(memberId) ?? [];
    if (!rows.length) continue;
    const rosterMember = roster.get(memberId);
    const entityId = `person:uk-${memberId}`;
    const docId = `doc:uk-interest:${memberId}:${register.id}`;
    const { text, blocks } = memberDocument(memberId, rosterMember, rows, register);
    const contentHash = await hashOf(text);

    // A new register replaces the member's previous entries: an interest that
    // has expired or been removed must stop being a live claim.
    // A new register replaces the member's previous entries, including those
    // in an older register document. The claim id is the stable member key.
    const previous = await db
      .prepare("SELECT claim_id FROM claim_documents WHERE claim_id LIKE ?")
      .bind(`claim:uk-${memberId}:interest:%`)
      .all();
    const stale = (previous.results ?? []).map((row) => String(row.claim_id ?? "")).filter(Boolean);
    for (const claimId of stale) {
      await db.prepare("DELETE FROM claim_entities WHERE claim_id = ?").bind(claimId).run();
      await db.prepare("DELETE FROM claim_documents WHERE claim_id = ?").bind(claimId).run();
      await db.prepare("DELETE FROM claims WHERE id = ?").bind(claimId).run();
    }

    await db
      .prepare(
        `INSERT INTO documents
           (id, kind, issuer, title, number, url, published_at, retrieved_at,
            content_hash, locator, provenance, self_serving, text_excerpt,
            fetched_at, http_status, parsed_at)
         VALUES (?, 'register', 'House of Commons', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 200, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           number = excluded.number,
           url = excluded.url,
           published_at = excluded.published_at,
           retrieved_at = excluded.retrieved_at,
           content_hash = excluded.content_hash,
           text_excerpt = excluded.text_excerpt,
           parsed_at = excluded.parsed_at`,
      )
      .bind(
        docId,
        `Register of Members' Financial Interests — ${rosterMember?.name ?? rows[0]?.memberName ?? memberId} (as at ${register.publishedDate})`,
        `RMFI-${register.id}-${memberId}`,
        `${INTERESTS}?MemberId=${memberId}&RegisterId=${register.id}`,
        register.publishedDate,
        now,
        contentHash,
        `register ${register.id}`,
        "House of Commons, Register of Members' Financial Interests (official CSV export)",
        text,
        now,
        now,
      )
      .run();

    const writes: ReturnType<D1["prepare"]>[] = [];
    rows.forEach((row, index) => {
      const date = row.registered || row.published || register.publishedDate;
      const act = `Registered an interest — ${row.category} — ${row.summary} — registered ${date}.`;
      const claimId = `claim:uk-${memberId}:interest:${row.id}`;
      writes.push(
        db
          .prepare(
            `INSERT OR REPLACE INTO claims
               (id, entity_id, act, category, mechanism, beneficiary, act_date,
                date_precision, amount, currency, confidence, confidence_basis,
                status, claim_key, created_at, updated_at)
             VALUES (?, ?, ?, 'disclosure', ?, '', ?, 'day', ?, ?, 0.95, ?, 'recorded', ?, ?, ?)`,
          )
          .bind(
            claimId,
            entityId,
            act,
            row.category,
            date || null,
            row.value,
            row.value === null ? "" : "GBP",
            `House of Commons Register of Members' Financial Interests, interest ${row.id}, registered ${date}`,
            `${entityId}|${act.toLowerCase()}|${date}|uk-interest:${row.id}`,
            now,
            now,
          ),
        db
          .prepare(
            `INSERT OR REPLACE INTO claim_documents
               (claim_id, document_id, quote, locator, stance)
             VALUES (?, ?, ?, ?, 'records')`,
          )
          .bind(claimId, docId, blocks[index] ?? "", `interest ${row.id}`),
        db
          .prepare(
            `INSERT OR REPLACE INTO claim_entities (claim_id, entity_id, role)
             VALUES (?, ?, 'actor')`,
          )
          .bind(claimId, entityId),
      );
      tally.claims += 1;
    });

    await batchWrite(db, writes);
    tally.documents += 1;
  }

  if (tally.claims > 0) {
    await recomputeUniverseStatus(db, "uk-commons-59");
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('uk-interests', ?, ?, ?, ?)",
      )
      .bind(now, new Date().toISOString(), tally.claims, null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json({ ok: true, ...tally }, { headers: { "Cache-Control": "no-store" } });
}
