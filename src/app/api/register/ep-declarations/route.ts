import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { recomputeUniverseStatus } from "@/lib/register/coverage-status";
import { exactSpan } from "@/lib/register/passage";
import { extractPdfText } from "@/lib/register/pdf";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/ep-declarations — read the conflicts MEPs declared.
 *
 * The Parliament publishes conflict-of-interest declarations as one PDF per
 * declaration. Its API filter `awareness-of-conflict` narrows 10,000 routine
 * forms to the 40 where the member said they were aware of a conflict. Only
 * those are ingested: a negative declaration is not a finding, and turning
 * 10,000 of them into claims would bury the 40 that say something.
 *
 * The claim is about the filing, not about guilt: "filed a conflict-of-interest
 * declaration", with the member's own description of the conflict in the
 * mechanism field. Some declarations say "no conflict" in the description even
 * though the awareness box is marked; the register records what the form says
 * and does not reconcile it in the member's favour or against them.
 *
 * The declaration is self-serving — the member wrote it — so the document is
 * marked `self_serving` and the stance is `admits`. It makes the member
 * `documented`, never `accused`.
 */

const LIST = "https://data.europarl.europa.eu/api/v2/meps-declarations";
const DIST = "https://data.europarl.europa.eu/distribution/doc";
const UA = "AdaGuillotine/1.0 (register ep declarations)";

// The positive option, in the languages the positive declarations use. Used
// only when the API has no conflict description; the description is preferred.
const POSITIVE = [
  /I am aware of having a conflict of interest[\s\S]*?declared\./,
  /J.ai connaissance d.un conflit d.intérêts[\s\S]*?déclarés\./,
  /Mir ist bekannt, dass ein Interessenkonflikt[\s\S]*?besteht\./,
  /Seznanjen\(-a\) sem z nasprotjem interesov[\s\S]*?pogajanji\./,
  /Jestem świadom\(-a\) istnienia konfliktu interesów[\s\S]*?negocjacjach\./,
];

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

interface Declaration {
  id: string;
  personId: string;
  date: string;
  title: string;
  url: string;
  language: string;
}

function parseDeclaration(row: Record<string, unknown>): Declaration | null {
  const id = String(row.identifier ?? String(row.id ?? "").replace(/^eli\/dl\/doc\//, ""));
  if (!id) return null;
  const personId = /^DCI-(\d+)-/.exec(id)?.[1] ?? "";
  if (!personId) return null;
  const date = String(row.document_date ?? "").slice(0, 10);
  const expressions = (row.is_realized_by ?? []) as Array<Record<string, unknown>>;
  const english =
    expressions.find(
      (entry) =>
        String(entry.language ?? "").endsWith("/ENG") ||
        String(entry.id ?? "").startsWith(`eli/dl/doc/${id}/en`),
    ) ?? expressions[0];
  const alternative = row.alternative_dcterms as Record<string, string> | undefined;
  const title =
    String(
      ((english?.title as Record<string, unknown> | undefined)?.en as string | undefined) ??
        alternative?.en ??
        (row.title_dcterms as Record<string, string> | undefined)?.en ??
        row.title ??
        "",
    ).trim();
  const formations = (english?.is_embodied_by ?? []) as Array<Record<string, unknown>>;
  const path = String(formations[0]?.is_exemplified_by ?? "");
  if (!path) return null;
  return {
    id,
    personId,
    date,
    title,
    language: String(english?.language ?? "").split("/").pop() ?? "",
    url: path.startsWith("http") ? path : `${DIST}/${path.replace(/^distribution\/doc\//, "")}`,
  };
}

async function declarationList(): Promise<Declaration[]> {
  const url = `${LIST}?parliamentary-term=10&filter-output=awareness-of-conflict&limit=100`;
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/ld+json" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`declarations list ${response.status}`);
  const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
  return (body.data ?? []).flatMap((row) => {
    const parsed = parseDeclaration(row);
    return parsed ? [parsed] : [];
  });
}

interface Detail {
  personId: string;
  awareness: boolean | null;
  description: string;
}

async function declarationDetail(declaration: Declaration): Promise<Detail | null> {
  const response = await fetch(`${LIST}/${declaration.id}`, {
    headers: { "user-agent": UA, accept: "application/ld+json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
  const detail = body.data?.[0];
  if (!detail) return null;
  const participation = (detail.workHadParticipation ?? []) as Array<Record<string, unknown>>;
  const people = (participation[0]?.had_participant_person ?? []) as string[];
  const personId = String(people[0] ?? "").replace(/^person\//, "") || declaration.personId;
  const awareness =
    typeof detail.awarenessOfConflict === "boolean" ? detail.awarenessOfConflict : null;
  return {
    personId,
    awareness,
    description: String(detail.conflictDescription ?? "").trim(),
  };
}

function nameFromTitle(title: string): string {
  // "Declaration on awareness of conflicts of interest - Name - Capacity - ..."
  const parts = title.split(/\s+-\s+/);
  return (parts[1] ?? "").trim();
}

function detailFromTitle(title: string): string {
  return title
    .replace(/^Declaration on awareness of conflicts of interest\s*-\s*/i, "")
    .replace(/^Declaration\s*-\s*/i, "");
}

function positiveOption(text: string): string | null {
  for (const pattern of POSITIVE) {
    const match = pattern.exec(text);
    if (match?.[0] && match[0].length >= 40) return match[0].trim();
  }
  return null;
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

  let declarations: Declaration[] = [];
  try {
    declarations = await declarationList();
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }

  const known = await db
    .prepare("SELECT id FROM documents WHERE id LIKE 'doc:ep:dci:%' AND parsed_at != ''")
    .all();
  const complete = new Set((known.results ?? []).map((row) => String(row.id ?? "")));
  const pending = declarations.filter(
    (declaration) => !complete.has(`doc:ep:dci:${declaration.id}`),
  );

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(40, Number(url.searchParams.get("limit") ?? 12) || 12));
  const selected = pending.slice(0, limit);

  const now = new Date().toISOString();
  const tally = {
    declarations: declarations.length,
    pending: pending.length,
    selected: selected.length,
    documents: 0,
    claims: 0,
    unread: 0,
    noPassage: 0,
    noDetail: 0,
    notAware: 0,
  };

  for (const declaration of selected) {
    const detail = await declarationDetail(declaration);
    if (!detail) {
      tally.noDetail += 1;
      continue;
    }
    if (detail.awareness === false) {
      tally.notAware += 1;
      continue;
    }

    const docId = `doc:ep:dci:${declaration.id}`;
    let bytes: Uint8Array | null = null;
    let status = 0;
    try {
      const response = await fetch(declaration.url, {
        headers: { "user-agent": UA, accept: "application/pdf,*/*" },
        signal: AbortSignal.timeout(60_000),
      });
      status = response.status;
      if (response.ok) bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      status = 0;
    }

    const text = bytes ? await extractPdfText(bytes) : null;
    if (!text) {
      tally.unread += 1;
      // Record the attempt without pretending the document was read.
      await db
        .prepare(
          `INSERT INTO documents
             (id, kind, issuer, title, number, url, published_at, retrieved_at,
              content_hash, locator, provenance, self_serving, text_excerpt,
              fetched_at, http_status, parsed_at)
           VALUES (?, 'register', 'European Parliament', ?, ?, ?, ?, ?, '', '', ?, 1, '', ?, ?, '')
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             url = excluded.url,
             retrieved_at = excluded.retrieved_at,
             http_status = excluded.http_status,
             parsed_at = ''`,
        )
        .bind(
          docId,
          declaration.title,
          declaration.id,
          declaration.url,
          declaration.date,
          now,
          "European Parliament, declaration of conflict of interest (PDF)",
          now,
          status,
        )
        .run();
      continue;
    }

    const description = detail.description || "";
    const span = description ? exactSpan(text, description) : null;
    const quote = span?.exact ?? positiveOption(text);
    if (!quote) {
      tally.noPassage += 1;
      continue;
    }

    const entityId = `person:ep-${detail.personId}`;
    const entity = await db
      .prepare("SELECT id FROM entities WHERE id = ?")
      .bind(entityId)
      .first<{ id: string }>();
    if (!entity) {
      const name = nameFromTitle(declaration.title);
      if (!name) {
        tally.noPassage += 1;
        continue;
      }
      await db
        .prepare(
          `INSERT INTO entities
             (id, kind, name, slug, country, affiliation, role, external_ids, created_at, updated_at)
           VALUES (?, 'person', ?, ?, '', '', 'MEP', ?, ?, ?)`,
        )
        .bind(
          entityId,
          name,
          `ep-${detail.personId}`,
          JSON.stringify({ europarl: detail.personId }),
          now,
          now,
        )
        .run();
    }

    const contentHash = await hashOf(text);
    const act = `Filed a conflict-of-interest declaration — ${detailFromTitle(declaration.title)} — declaration ${declaration.id}.`;
    const claimId = `claim:ep-${detail.personId}:declaration:${declaration.id}`;

    await db
      .prepare(
        `INSERT INTO documents
           (id, kind, issuer, title, number, url, published_at, retrieved_at,
            content_hash, locator, provenance, self_serving, text_excerpt,
            fetched_at, http_status, parsed_at)
         VALUES (?, 'register', 'European Parliament', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           published_at = excluded.published_at,
           retrieved_at = excluded.retrieved_at,
           content_hash = excluded.content_hash,
           text_excerpt = excluded.text_excerpt,
           parsed_at = excluded.parsed_at`,
      )
      .bind(
        docId,
        declaration.title,
        declaration.id,
        declaration.url,
        declaration.date,
        now,
        contentHash,
        `declaration ${declaration.id}`,
        "European Parliament, declaration of conflict of interest (PDF)",
        text,
        now,
        status,
        now,
      )
      .run();

    await db
      .prepare(
        `INSERT OR REPLACE INTO claims
           (id, entity_id, act, category, mechanism, beneficiary, act_date,
            date_precision, amount, currency, confidence, confidence_basis,
            status, claim_key, created_at, updated_at)
         VALUES (?, ?, ?, 'disclosure', ?, '', ?, 'day', NULL, '', 0.9, ?, 'recorded', ?, ?, ?)`,
      )
      .bind(
        claimId,
        entityId,
        act,
        description,
        declaration.date || null,
        `European Parliament declaration ${declaration.id}, ${declaration.date}; awarenessOfConflict=true${
          description ? `; description: "${description}"` : ""
        }`,
        `${entityId}|${act.toLowerCase()}|${declaration.date}`,
        now,
        now,
      )
      .run();

    await db
      .prepare(
        `INSERT OR REPLACE INTO claim_documents
           (claim_id, document_id, quote, locator, stance)
         VALUES (?, ?, ?, ?, 'admits')`,
      )
      .bind(claimId, docId, quote, `declaration ${declaration.id} · conflict of interest`)
      .run();

    await db
      .prepare(
        `INSERT OR REPLACE INTO claim_entities (claim_id, entity_id, role)
         VALUES (?, ?, 'actor')`,
      )
      .bind(claimId, entityId)
      .run();

    tally.documents += 1;
    tally.claims += 1;
  }

  if (tally.claims > 0) {
    await recomputeUniverseStatus(db, "ep-10");
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('ep-declarations', ?, ?, ?, ?)",
      )
      .bind(
        now,
        new Date().toISOString(),
        tally.claims,
        tally.unread || tally.noDetail || tally.noPassage
          ? `${tally.unread} unread, ${tally.noDetail} no detail, ${tally.noPassage} no passage`
          : null,
      )
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json({ ok: true, ...tally }, { headers: { "Cache-Control": "no-store" } });
}
