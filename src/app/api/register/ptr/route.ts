import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { extractPdfText } from "@/lib/register/pdf";
import { parsePtr, transactionAct } from "@/lib/register/ptr";
import { unzip } from "@/lib/register/zip";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/ptr?phase=index&year=2026
 * POST /api/register/ptr?phase=parse&limit=5
 *
 * The money layer. Two phases because they have different failure modes:
 * the index is one ZIP of structured metadata and cannot really go wrong, while
 * the filings are encrypted PDFs of a scanned-looking table, and a parser that
 * is 95% right is wrong. So the index is ingested wholesale, and the PDFs are
 * read a few at a time, each one either parsed with a verbatim passage or
 * marked unread.
 *
 * What a parsed trade proves: the filing says the member (or their spouse, or a
 * dependent) bought or sold that asset on that date, in that disclosed band.
 * Nothing more. A trade is not misconduct; the record says what happened and the
 * reader decides what it means next to a committee seat.
 */

const UA = "AdaGuillotine/1.0 (register PTR connector)";
const BATCH = 60;

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
  return match ? match[1].trim() : "";
}

/** `AL04` → state AL, district 4. `AK00` and `At Large` are the same seat. */
function seat(stateDst: string): { state: string; district: string } {
  const match = /^([A-Z]{2})(\d{2})$/.exec(stateDst.trim().toUpperCase());
  if (!match) return { state: "", district: "" };
  const n = Number(match[2]);
  return { state: match[1], district: n === 0 ? "AL" : String(n) };
}

/** `4th`, `04`, `4` and `At Large` are four spellings of two seats. */
function normalDistrict(value: string): string {
  const clean = value.trim();
  if (/at large/i.test(clean)) return "AL";
  const digits = /^(\d+)/.exec(clean);
  if (digits) return String(Number(digits[1]));
  return clean;
}

function surnameOf(name: string): string {
  const parts = name
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  // "Beyer, Jr." leaves a comma behind if the suffix is only stripped as a
  // word: the surname came out as "beyer," and matched nobody.
  return (parts[parts.length - 1] ?? "").replace(/[^a-z]/gi, "").toLowerCase();
}

/** `3/24/2025` → `2025-03-24`. */
function isoDate(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return "";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function humanDate(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${months[Number(month) - 1] ?? month} ${year}`;
}

async function hashOf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function runIndex(db: D1, year: number) {
  const zipUrl = `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${year}FD.zip`;
  const response = await fetch(zipUrl, {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) return { error: `index ${response.status}`, url: zipUrl };

  const entries = unzip(new Uint8Array(await response.arrayBuffer()));
  const xml = entries.find((entry) => entry.name.toLowerCase().endsWith(".xml"));
  if (!xml) return { error: "no xml in the index zip", url: zipUrl };

  const text = new TextDecoder("utf-8").decode(xml.data);
  const blocks = text.match(/<Member>[\s\S]*?<\/Member>/g) ?? [];

  // Who is who, once: the universe gives seat → entity, so a filing joins to a
  // person by seat and surname rather than by a guess from prose.
  const roster = await db
    .prepare(
      `SELECT e.id, e.name, e.state, e.district
         FROM universe_members m
         JOIN entities e ON e.id = m.entity_id
        WHERE m.universe_id = 'house-119'`,
    )
    .all();
  const bySeat = new Map<string, Array<{ id: string; surname: string }>>();
  const byState = new Map<string, Array<{ id: string; surname: string }>>();
  for (const row of roster.results ?? []) {
    const person = { id: String(row.id), surname: surnameOf(String(row.name ?? "")) };
    const state = String(row.state ?? "");
    const key = `${state}-${normalDistrict(String(row.district ?? ""))}`;
    bySeat.set(key, [...(bySeat.get(key) ?? []), person]);
    byState.set(state, [...(byState.get(state) ?? []), person]);
  }

  const writes: ReturnType<D1["prepare"]>[] = [];
  let filings = 0;
  let resolved = 0;
  let unresolved = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const block of blocks) {
    const type = tag(block, "FilingType");
    if (type !== "P") {
      skipped += 1;
      continue;
    }
    const docId = tag(block, "DocID");
    if (!docId) continue;
    const url = `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${year}/${docId}.pdf`;
    const first = tag(block, "First");
    const last = tag(block, "Last");
    const stateDst = tag(block, "StateDst");
    const filed = isoDate(tag(block, "FilingDate"));
    const { state, district } = seat(stateDst);
    const surname = last.replace(/[^a-z]/gi, "").toLowerCase();
    let match = (bySeat.get(`${state}-${district}`) ?? []).filter((c) => c.surname === surname);
    if (!match.length) {
      // Districts move between a filing and a roster. A surname that occurs
      // once in the state is still an identification; two is a question.
      match = (byState.get(state) ?? []).filter((c) => c.surname === surname);
    }
    const entity = match.length === 1 ? match[0].id : "";

    if (entity) resolved += 1;
    else unresolved += 1;

    writes.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO documents
             (id, kind, issuer, title, number, url, published_at, retrieved_at,
              content_hash, provenance, fetched_at, http_status)
           VALUES (?, 'ptr', 'U.S. House of Representatives', ?, ?, ?, ?, ?, '', ?, '', 0)`,
        )
        .bind(
          `doc:${url}`,
          `Periodic Transaction Report — ${first} ${last} (${stateDst})`,
          docId,
          url,
          filed,
          now,
          "Clerk of the House, financial disclosure index",
        ),
      db
        .prepare(
          `INSERT OR REPLACE INTO ptr_filings
             (document_id, doc_id, year, filing_type, filing_date, state_dst,
              filer_name, member_entity, transactions, parsed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '')`,
        )
        .bind(
          `doc:${url}`,
          docId,
          year,
          type,
          filed,
          stateDst,
          `${first} ${last}`.trim(),
          entity,
        ),
    );
    filings += 1;
  }

  await batchWrite(db, writes);
  return { url: zipUrl, filings, resolved, unresolved, skippedOtherTypes: skipped };
}

async function runParse(db: D1, limit: number) {
  const queue = await db
    .prepare(
      `SELECT d.id, d.url, d.number, f.doc_id, f.filing_date, f.state_dst,
              f.filer_name, f.member_entity
         FROM documents d
         JOIN ptr_filings f ON f.document_id = d.id
        WHERE d.kind = 'ptr' AND d.parsed_at = ''
        ORDER BY f.filing_date DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all();

  const docs = (queue.results ?? []).map((row) => ({
    id: String(row.id ?? ""),
    url: String(row.url ?? ""),
    docId: String(row.doc_id ?? ""),
    filed: String(row.filing_date ?? ""),
    stateDst: String(row.state_dst ?? ""),
    filer: String(row.filer_name ?? ""),
    entity: String(row.member_entity ?? ""),
  }));

  const now = new Date().toISOString();
  const tally = { documents: docs.length, parsed: 0, unread: 0, transactions: 0, claimed: 0, noEntity: 0 };

  for (const doc of docs) {
    let bytes = new Uint8Array(0);
    let status = 0;
    try {
      const response = await fetch(doc.url, {
        headers: { "user-agent": UA, accept: "application/pdf" },
        signal: AbortSignal.timeout(30_000),
      });
      status = response.status;
      if (response.ok) bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      status = 0;
    }

    const text = bytes.length ? await extractPdfText(bytes) : null;
    const rows = text ? parsePtr(text, { name: doc.filer, stateDst: doc.stateDst }) : [];

    if (!text) {
      // Refused, encrypted with something stronger than RC4, or not text at all.
      tally.unread += 1;
      await db
        .prepare("UPDATE documents SET fetched_at = ?, parsed_at = ?, http_status = ? WHERE id = ?")
        .bind(now, now, status, doc.id)
        .run();
      continue;
    }

    await db
      .prepare(
        `UPDATE documents
            SET text_excerpt = ?, content_hash = ?, fetched_at = ?, parsed_at = ?, http_status = ?
          WHERE id = ?`,
      )
      .bind(text, await hashOf(bytes), now, now, status, doc.id)
      .run();

    const writes: ReturnType<D1["prepare"]>[] = [];
    rows.forEach((row, index) => {
      const transactionId = `ptr:${doc.docId}:${index}`;
      const claimId = `claim:ptr:${doc.docId}:${index}`;
      writes.push(
        db
          .prepare(
            `INSERT OR REPLACE INTO ptr_transactions
               (id, document_id, entity_id, owner, asset, ticker, asset_type,
                txn_type, txn_date, notified, amount_low, amount_high,
                amount_label, line, claim_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            transactionId,
            doc.id,
            doc.entity,
            row.owner,
            row.asset,
            row.ticker,
            row.assetType,
            row.type,
            row.date,
            row.notified,
            row.amountLow,
            row.amountHigh,
            row.amountLabel,
            row.line,
            doc.entity ? claimId : "",
          ),
      );

      if (!doc.entity) return;

      const act = transactionAct(row, { docId: doc.docId, filed: humanDate(doc.filed) });
      const basis = `House PTR ${doc.docId}, filed ${humanDate(doc.filed)}: ${row.type} ${row.amountLabel} on ${row.date}`;
      const claimKey = `${doc.entity.toLowerCase()}|${act.replace(/\s+/g, " ").trim().toLowerCase()}|${row.date}`;

      writes.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO claims
               (id, entity_id, act, category, mechanism, beneficiary, act_date,
                date_precision, amount, currency, confidence, confidence_basis,
                status, claim_key, legacy_id, created_at, updated_at)
             VALUES (?, ?, ?, 'finance', '', '', ?, 'day', ?, 'USD', 0.95, ?, 'recorded', ?, NULL, ?, ?)`,
          )
          .bind(
            claimId,
            doc.entity,
            act,
            row.date,
            row.amountLow,
            basis,
            claimKey,
            now,
            now,
          ),
        db
          .prepare(
            "INSERT OR IGNORE INTO claim_entities (claim_id, entity_id, role) VALUES (?, ?, 'actor')",
          )
          .bind(claimId, doc.entity),
        db
          .prepare(
            `INSERT OR IGNORE INTO claim_documents
               (claim_id, document_id, quote, locator, stance)
             VALUES (?, ?, ?, ?, 'records')`,
          )
          .bind(claimId, doc.id, row.quote, `ptr ${doc.docId} · line ${row.line}`),
      );
      tally.claimed += 1;
    });

    writes.push(
      db
        .prepare("UPDATE ptr_filings SET transactions = ?, parsed_at = ? WHERE document_id = ?")
        .bind(rows.length, now, doc.id),
    );

    await batchWrite(db, writes);
    tally.parsed += 1;
    tally.transactions += rows.length;
    if (!doc.entity) tally.noEntity += 1;
  }

  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('ptr', ?, ?, ?, ?)",
      )
      .bind(
        now,
        new Date().toISOString(),
        tally.transactions,
        tally.unread ? `${tally.unread} unreadable` : null,
      )
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return tally;
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

  const params = new URL(request.url).searchParams;
  const phase = params.get("phase") ?? "index";
  const now = new Date().toISOString();

  if (phase === "index") {
    const year = Math.max(2008, Math.min(2100, Number(params.get("year") ?? 2026) || 2026));
    const result = await runIndex(db, year);
    if ("error" in result) return Response.json({ ok: false, phase, year, ...result }, { status: 502 });
    try {
      await db
        .prepare(
          "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('ptr-index', ?, ?, ?, ?)",
        )
        .bind(now, new Date().toISOString(), (result as { filings: number }).filings, null)
        .run();
    } catch {
      /* logging never blocks the pass */
    }
    return Response.json({ ok: true, phase, year, ...result });
  }

  if (phase === "parse") {
    const limit = Math.max(1, Math.min(20, Number(params.get("limit") ?? 5) || 5));
    const result = await runParse(db, limit);
    return Response.json({ ok: true, phase, ...result });
  }

  return Response.json({ error: "phase must be index or parse" }, { status: 400 });
}
