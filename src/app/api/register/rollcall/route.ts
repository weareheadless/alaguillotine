import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, type D1 } from "@/lib/clock-store";
import { isAdminAuthed } from "@/lib/admin-auth";
import { compareVote, parseRollCall } from "@/lib/register/rollcall";

export const dynamic = "force-dynamic";

type Env = { CRON_SECRET?: string };

/**
 * POST /api/register/rollcall?limit=4 — turn a vote file into fields, then
 * check every claim that points at it.
 *
 * This is the first connector in the register: an issuer (the House Clerk), a
 * document with a number and a date, a parsed structure, and a comparison. It
 * exists because 4,415 claims in the archive are votes, the largest and best
 * sourced block in the record, and a vote is not a sentence. Running sentence
 * matching over roll-call XML produced 3,591 false verifications, so the fix is
 * not a better matcher: it is to read the file as what it is.
 *
 * What this proves, exactly: the claim ids in the archive are already keyed by
 * bioguide (`claim:A000055:vote:2023:564`) and every vote matches the Clerk's
 * file. These claims were derived from these files in the first place, so this
 * establishes provenance — the sentence, the file, the member and the vote line
 * up and stay lined up — not independent corroboration. A recorded vote is a
 * fact about the House, not a finding of wrongdoing. It is the spine that
 * documents about money attach to.
 *
 * Writes go through D1 `batch`. One statement per subrequest hit the Workers
 * ceiling partway through a file and dropped the tail silently: 99 claims of
 * 232 written, alphabetically, with a 200 response. Batching makes the cost of
 * a file one subrequest per hundred rows.
 */

const UA = "AdaGuillotine/1.0 (register roll-call connector)";
const MAX_XML = 500_000;
const BATCH = 90;

async function hashOf(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function batchWrite(db: D1, statements: ReturnType<D1["prepare"]>[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (db.batch) await db.batch(chunk);
    else for (const statement of chunk) await statement.run();
  }
}

/** `claim:A000055:vote:2023:564` — the bioguide id the archive already filed under. */
function bioguideFrom(claimId: string): string {
  const match = /^claim:([A-Z]\d{6}):vote:/i.exec(claimId);
  return match ? match[1].toUpperCase() : "";
}

function claimedVote(act: string): string {
  const match = /^Voted\s+(Yea|Nay|Aye|No|Present)\b/i.exec(act.trim());
  return match ? match[1] : "";
}

function claimedRoll(act: string): number {
  const match = /roll call\s+(\d+)/i.exec(act);
  return match ? Number(match[1]) : 0;
}

interface Row {
  id: string;
  entity_id: string;
  act: string;
  claim_id: string;
  name: string;
}

const SUFFIX = /^(jr|sr|ii|iii|iv)$/i;

/** "Michael R. Turner" → "turner"; "Marie Gluesenkamp Perez" → "perez". */
function surnameOf(name: string): string {
  const parts = name.replace(/\(.*?\)/g, " ").trim().split(/\s+/).filter(Boolean);
  while (
    parts.length > 1 &&
    (SUFFIX.test(parts[parts.length - 1]) || /^[A-Z]\.?$/.test(parts[parts.length - 1]))
  ) {
    parts.pop();
  }
  return (parts[parts.length - 1] ?? "").toLowerCase();
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

  const limit = Math.max(
    1,
    Math.min(8, Number(new URL(request.url).searchParams.get("limit") ?? 4) || 4),
  );
  const started = new Date().toISOString();
  const now = started;

  // Most-cited first: each roll call grounds hundreds of claims.
  const queue = await db
    .prepare(
      `SELECT d.id, d.url, COUNT(cd.claim_id) AS uses
         FROM documents d
         LEFT JOIN claim_documents cd ON cd.document_id = d.id
        WHERE d.kind = 'roll_call' AND d.parsed_at = ''
        GROUP BY d.id
        ORDER BY uses DESC, d.id
        LIMIT ?`,
    )
    .bind(limit)
    .all();

  const docs = (queue.results ?? []).map((r) => ({
    id: String(r.id ?? ""),
    url: String(r.url ?? ""),
  }));

  // Who we can name by number, once, so deriving the votes the archive missed
  // does not cost a query per member.
  const known = await db
    .prepare(
      `SELECT id, json_extract(external_ids, '$.bioguide') AS bioguide
         FROM entities
        WHERE kind = 'person'
          AND json_extract(external_ids, '$.bioguide') IS NOT NULL`,
    )
    .all();
  const entityByBioguide = new Map(
    (known.results ?? []).map((r) => [String(r.bioguide), String(r.id)]),
  );

  let parsed = 0;
  let failed = 0;
  let votes = 0;
  let examined = 0;
  const tally = {
    agrees: 0,
    refuted: 0,
    notInRoll: 0,
    ambiguous: 0,
    mismatch: 0,
    noVote: 0,
    derived: 0,
    unresolvedVoters: 0,
  };

  const one = async (doc: { id: string; url: string }) => {
    let xml = "";
    let status = 0;
    try {
      const res = await fetch(doc.url, {
        headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      status = res.status;
      if (res.ok) xml = (await res.text()).slice(0, MAX_XML);
    } catch {
      status = 0;
    }

    const { meta, votes: cast, fragments } = parseRollCall(xml);
    if (!xml || !meta) {
      await db
        .prepare("UPDATE documents SET fetched_at = ?, http_status = ? WHERE id = ?")
        .bind(now, status, doc.id)
        .run();
      failed += 1;
      return;
    }

    const claims = await db
      .prepare(
        `SELECT c.id, c.entity_id, c.act, cd.claim_id, e.name
           FROM claims c
           JOIN claim_documents cd ON cd.claim_id = c.id
           JOIN entities e ON e.id = c.entity_id
          WHERE cd.document_id = ? AND c.status IN ('legacy', 'matched', 'recorded', 'refuted')`,
      )
      .bind(doc.id)
      .all();

    const rows = (claims.results ?? []) as unknown as Row[];
    const byId = new Map(cast.map((v) => [v.nameId, v]));
    const bySurname = new Map<string, typeof cast>();
    for (const v of cast) {
      const key = v.sortName.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
      bySurname.set(key, [...(bySurname.get(key) ?? []), v]);
    }

    // One batch for the document, its metadata and every member's vote.
    const writes: ReturnType<D1["prepare"]>[] = [
      db
        .prepare(
          `UPDATE documents
              SET text_excerpt = ?, content_hash = ?, fetched_at = ?, parsed_at = ?,
                  http_status = ?, issuer = ?, title = ?, number = ?, published_at = ?
            WHERE id = ?`,
        )
        .bind(
          xml,
          await hashOf(xml),
          now,
          now,
          status,
          meta.chamber || "U.S. House of Representatives",
          meta.description || `${meta.legislation} — ${meta.question}`,
          `${meta.congress}-${meta.roll}`,
          meta.actionDate,
          doc.id,
        ),
      db
        .prepare(
          `INSERT OR REPLACE INTO roll_calls
             (document_id, congress, session, chamber, roll, legislation, question,
              kind, result, action_date, description, parsed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          doc.id,
          meta.congress,
          meta.session,
          meta.chamber,
          meta.roll,
          meta.legislation,
          meta.question,
          meta.kind,
          meta.result,
          meta.actionDate,
          meta.description,
          now,
        ),
    ];

    const voteStatement = db.prepare(
      `INSERT OR REPLACE INTO roll_votes
         (document_id, name_id, sort_name, party, state, vote)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const v of cast) {
      writes.push(voteStatement.bind(doc.id, v.nameId, v.sortName, v.party, v.state, v.vote));
    }

    await batchWrite(db, writes);
    parsed += 1;
    votes += cast.length;

    // Now the claims, in one batch of their own: each is a status, a basis, a
    // passage and — first time only — an identity.
    const claimsWrites: ReturnType<D1["prepare"]>[] = [];
    for (const claim of rows) {
      examined += 1;
      const claimed = claimedVote(claim.act);
      const rollInAct = claimedRoll(claim.act);
      if (!claimed) {
        tally.noVote += 1;
        continue;
      }
      // The sentence names a roll number. If it is not this file's number, the
      // link is wrong and this connector is not the one to repair it.
      if (rollInAct && rollInAct !== meta.roll) {
        tally.mismatch += 1;
        continue;
      }

      let record = byId.get(bioguideFrom(claim.id));
      if (!record) {
        // Not filed under a bioguide: a surname that occurs once in this roll
        // call. Two members with the same surname is not a match, it is a
        // question for a human.
        const same = bySurname.get(surnameOf(claim.name)) ?? [];
        if (same.length > 1) {
          tally.ambiguous += 1;
          continue;
        }
        record = same[0];
      }
      if (!record) {
        tally.notInRoll += 1;
        continue;
      }

      const finding = compareVote(claimed, record.vote);
      if (finding.kind === "absent") {
        tally.notInRoll += 1;
        continue;
      }

      const agreed = finding.kind === "agrees";
      tally[agreed ? "agrees" : "refuted"] += 1;

      const where = `${meta.chamber || "House"} roll call ${meta.roll}, ${meta.actionDate}`;
      const basis = agreed
        ? `${where}: recorded ${record.vote}`
        : finding.kind === "conflicts"
          ? `${where}: the record says ${record.vote}`
          : `${where}: recorded as ${record.vote}`;

      claimsWrites.push(
        db
          .prepare(
            `UPDATE claims
                SET status = ?, confidence = ?, confidence_basis = ?,
                    act_date = COALESCE(NULLIF(act_date, ''), ?),
                    date_precision = CASE WHEN act_date IS NULL OR act_date = '' THEN 'day' ELSE date_precision END,
                    updated_at = ?
              WHERE id = ?`,
          )
          .bind(agreed ? "recorded" : "refuted", 0.95, basis, meta.actionDate, now, claim.id),
        // The passage is the exact substring the vote was read from: byte for
        // byte what is in the Clerk's file, locatable by bioguide.
        db
          .prepare(
            `UPDATE claim_documents
                SET quote = ?, locator = ?, stance = 'records'
              WHERE claim_id = ? AND document_id = ?`,
          )
          .bind(
            fragments.get(record.nameId) ?? "",
            `roll ${meta.roll} · bioguide ${record.nameId}`,
            claim.id,
            doc.id,
          ),
        // Identity, once, from the record: the bioguide id is how every later
        // document about this person joins to them without going through a name.
        db
          .prepare(
            `UPDATE entities
                SET external_ids = json_object('bioguide', ?), updated_at = ?
              WHERE id = ? AND (external_ids = '{}' OR external_ids = '')`,
          )
          .bind(record.nameId, now, claim.entity_id),
      );
    }

    await batchWrite(db, claimsWrites);

    // Every member in this file is a fact about the file. The archive happened
    // to file claims for some voters and not others, and the pattern of who was
    // missed fell entirely on one party — which would have been published as a
    // finding about Democrats. So the missing voters are derived: same file,
    // same passage, same wording as the claims already filed for this roll.
    const filed = new Set(rows.map((r) => bioguideFrom(r.id)));
    const template = rows.find((r) => /^Voted\s/i.test(r.act))?.act ?? "";
    const modal = await db
      .prepare(
        `SELECT c.category, COUNT(*) AS n
           FROM claims c
           JOIN claim_documents cd ON cd.claim_id = c.id
          WHERE cd.document_id = ? AND c.act LIKE 'Voted %'
          GROUP BY c.category ORDER BY n DESC LIMIT 1`,
      )
      .bind(doc.id)
      .first<{ category: string }>();
    const category = String(modal?.category ?? "");
    const year = (/\/(\d{4})\/roll\d+\.xml/.exec(doc.url) ?? [])[1] ?? meta.actionDate.slice(0, 4);

    const derivedWrites: ReturnType<D1["prepare"]>[] = [];
    for (const voter of cast) {
      if (filed.has(voter.nameId)) continue;
      const entityId = entityByBioguide.get(voter.nameId);
      if (!entityId) {
        // No entity for this person: a former member the archive never named.
        // Creating one from a surname in a vote file would be invention.
        tally.unresolvedVoters += 1;
        continue;
      }
      const act = template
        ? template.replace(/^Voted\s+\w+/i, `Voted ${voter.vote}`)
        : `Voted ${voter.vote} — ${meta.legislation}, "${meta.description}" (${meta.question}) — roll call ${meta.roll}, ${meta.actionDate}.`;
      const claimId = `claim:${voter.nameId}:vote:${year}:${meta.roll}`;
      const claimKey = `${entityId.toLowerCase()}|${act.replace(/\s+/g, " ").trim().toLowerCase()}|${meta.actionDate}`;
      const basis = `${meta.chamber || "House"} roll call ${meta.roll}, ${meta.actionDate}: recorded ${voter.vote} (derived from the file; no claim had been filed)`;

      derivedWrites.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO claims
               (id, entity_id, act, category, mechanism, beneficiary, act_date,
                date_precision, amount, currency, confidence, confidence_basis,
                status, claim_key, legacy_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, '', '', ?, 'day', NULL, '', 0.95, ?, 'recorded', ?, NULL, ?, ?)`,
          )
          .bind(claimId, entityId, act, category, meta.actionDate, basis, claimKey, now, now),
        db
          .prepare(
            "INSERT OR IGNORE INTO claim_entities (claim_id, entity_id, role) VALUES (?, ?, 'actor')",
          )
          .bind(claimId, entityId),
        db
          .prepare(
            `INSERT OR IGNORE INTO claim_documents
               (claim_id, document_id, quote, locator, stance)
             VALUES (?, ?, ?, ?, 'records')`,
          )
          .bind(
            claimId,
            doc.id,
            fragments.get(voter.nameId) ?? "",
            `roll ${meta.roll} · bioguide ${voter.nameId}`,
          ),
      );
      tally.derived += 1;
    }

    await batchWrite(db, derivedWrites);
  };

  // Two files at a time: each is ~650 writes, and a leased job is one that can
  // finish and be resumed, not one that tests the ceiling.
  for (let i = 0; i < docs.length; i += 2) {
    await Promise.all(docs.slice(i, i + 2).map(one));
  }

  const updated = tally.agrees + tally.refuted;
  try {
    await db
      .prepare(
        "INSERT INTO register_runs (job, started_at, finished_at, rows, error) VALUES ('rollcall', ?, ?, ?, ?)",
      )
      .bind(started, new Date().toISOString(), updated, failed ? `${failed} unfetchable` : null)
      .run();
  } catch {
    /* logging never blocks the pass */
  }

  return Response.json(
    { ok: true, documents: docs.length, parsed, failed, votes, examined, ...tally },
    { headers: { "Cache-Control": "no-store" } },
  );
}
