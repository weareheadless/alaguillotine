import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { countryLabel } from "@/lib/register/countries";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/ep — declare the European Parliament, 10th term.
 *
 * The register was built around one body and then described itself as if that
 * body were the world. This is the second declaration: every current Member of
 * the European Parliament, taken from the Parliament's own open-data list, with
 * the country they represent and the political group they sit in.
 *
 * The list is unusually generous. It carries `api:country-of-representation`
 * and `api:political-group` on each compact record, so 720 people are declared
 * with two calls rather than 720. No names are inferred from a vote file, and
 * nobody is matched by surname: the entity id is the Parliament's own person
 * identifier, and the external id records it.
 *
 * This declares a population; it does not read any documents about it. Read,
 * documented and accused will all be zero until a document connector for this
 * body exists, and the coverage page says exactly that rather than implying the
 * Parliament is clean.
 */

const LIST = "https://data.europarl.europa.eu/api/v2/meps/show-current";
const UA = "AdaGuillotine/1.0 (register european parliament)";
const BATCH = 60;
const PAGE = 500;

const GROUPS: Record<string, string> = {
  PPE: "European People's Party",
  "S&D": "Socialists and Democrats",
  PfE: "Patriots for Europe",
  ECR: "European Conservatives and Reformists",
  Renew: "Renew Europe",
  "Verts/ALE": "Greens/European Free Alliance",
  "The Left": "The Left",
  ESN: "Europe of Sovereign Nations",
  NI: "Non-attached",
};

interface Mep {
  id: string;
  name: string;
  country: string;
  group: string;
}

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
}

async function fetchPage(offset: number): Promise<Mep[]> {
  const url = `${LIST}?limit=${PAGE}&offset=${offset}`;
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/ld+json" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`EP list ${response.status}`);
  const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
  const rows = body.data ?? [];
  return rows.flatMap((row) => {
    const id = String(row.identifier ?? String(row.id ?? "").replace(/^person\//, ""));
    const name = String(row.label ?? "").trim();
    if (!id || !name) return [];
    return [
      {
        id,
        name,
        country: String(row["api:country-of-representation"] ?? ""),
        group: String(row["api:political-group"] ?? ""),
      },
    ];
  });
}

function slugFor(id: string): string {
  return `ep-${id}`;
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

  let meps: Mep[] = [];
  try {
    for (let offset = 0; ; offset += PAGE) {
      const page = await fetchPage(offset);
      meps = meps.concat(page);
      if (page.length < PAGE) break;
      if (offset > 5000) throw new Error("EP list did not terminate");
    }
  } catch (error) {
    return Response.json({ error: `EP list unavailable: ${String(error)}` }, { status: 502 });
  }

  // One person, one row. The list is a snapshot of active mandates; duplicates
  // would be a defect in the source, not two people.
  const byId = new Map<string, Mep>();
  for (const mep of meps) byId.set(mep.id, mep);
  meps = [...byId.values()];

  const now = new Date().toISOString();
  const groups = new Map<string, number>();
  const countries = new Map<string, number>();
  for (const mep of meps) {
    if (mep.group) groups.set(mep.group, (groups.get(mep.group) ?? 0) + 1);
    if (mep.country) countries.set(mep.country, (countries.get(mep.country) ?? 0) + 1);
  }

  const description =
    `${meps.length} current Members of the European Parliament, 10th term, from the Parliament's ` +
    `open-data list on ${now.slice(0, 10)}. ${countries.size} member states represented, ` +
    `${groups.size} political groups. The roster is the declaration; documents read ` +
    `against this population are counted above and never mixed with another body.`;

  await db
    .prepare(
      `INSERT INTO universes
         (id, name, description, definition, source_url, declared_at, expected,
          country, body, body_key)
       VALUES ('ep-10', ?, ?, ?, ?, ?, ?, '', ?, 'EU-Parliament')
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
      "The European Parliament, 10th term",
      description,
      "Every current Member of the European Parliament, enumerated from the EP Open Data API's show-current list and identified by the Parliament's own person id.",
      LIST,
      now,
      meps.length,
      "European Parliament",
    )
    .run();

  const writes: ReturnType<D1["prepare"]>[] = [];
  for (const mep of meps) {
    const entityId = `person:ep-${mep.id}`;
    const country = countryLabel(mep.country);
    writes.push(
      db
        .prepare(
          `INSERT INTO entities
             (id, kind, name, slug, country, affiliation, role, external_ids, created_at, updated_at)
           VALUES (?, 'person', ?, ?, ?, ?, 'MEP', ?, ?, ?)
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
          mep.name,
          slugFor(mep.id),
          country,
          mep.group,
          JSON.stringify({ europarl: mep.id }),
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO universe_members (universe_id, entity_id, status, note)
           VALUES ('ep-10', ?, 'listed', ?)
           ON CONFLICT(universe_id, entity_id) DO NOTHING`,
        )
        .bind(entityId, mep.group || ""),
    );
  }

  await batchWrite(db, writes);

  // Anything previously declared but no longer in the current list is marked
  // excluded rather than deleted: a mandate can end, and the register should be
  // able to show that it once counted them.
  const listed = new Set(meps.map((mep) => `person:ep-${mep.id}`));
  const existing = await db
    .prepare("SELECT entity_id FROM universe_members WHERE universe_id = 'ep-10'")
    .all();
  const stale = (existing.results ?? [])
    .map((row) => String(row.entity_id ?? ""))
    .filter((id) => id && !listed.has(id));
  for (const id of stale) {
    await db
      .prepare("UPDATE universe_members SET status = 'excluded' WHERE universe_id = 'ep-10' AND entity_id = ?")
      .bind(id)
      .run();
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('ep-universe', ?, ?, ?, ?)",
      )
      .bind(now, new Date().toISOString(), meps.length, null)
      .run();
  } catch {
    /* logging never blocks the declaration */
  }

  return Response.json(
    {
      ok: true,
      universe: "ep-10",
      expected: meps.length,
      countries: Object.fromEntries([...countries.entries()].sort((a, b) => b[1] - a[1])),
      groups: Object.fromEntries(
        [...groups.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([code, n]) => [`${code} — ${GROUPS[code] ?? code}`, n]),
      ),
      excluded: stale.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
