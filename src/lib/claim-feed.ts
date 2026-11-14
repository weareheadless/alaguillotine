type LedgerDb = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      run: () => Promise<unknown>;
      all: () => Promise<{ results?: Array<Record<string, unknown>> }>;
    };
  };
};

/**
 * From the record to the front page.
 *
 * A claim that only ever appears on its own person's page is a claim nobody
 * reads. This is the bridge: when a claim is on the record and past review, it
 * becomes a card in the feed, with its grade, its category and a link back to
 * the ledger. It is idempotent — the feed id is the claim id — so the twelve
 * hour pass can call it every time without ever showing the same act twice.
 *
 * What does not cross the bridge:
 *
 *   pending   a filed claim nobody has checked yet. Only one with a documentary
 *             basis (grade A or B) reaches the front page, and it arrives
 *             tagged "filed, awaiting review" at low weight, so it is read as a
 *             filing and not as the desk's finding. A pending grade C or D waits
 *             on the person's page instead; the front page is not the queue.
 *   D         a single unverified allegation. Never on the front page.
 */

/**
 * The label says what the evidence is, not what letter it earned.
 *
 * "Grade B" is a letter; "2 sources: courtlistener.com, reuters.com" is
 * something a reader can open. The count is separate domains, so three
 * syndications of one wire story are not three sources.
 */
/** www.bbc.co.uk, news.bbc.co.uk and bbc.co.uk are one source. */
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
function site(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const last = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  if (last.length === 2 && SECOND_LEVEL.has(second)) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function evidenceLine(raw: unknown, grade: string): string {
  let sources: string[] = [];
  try {
    sources = Array.isArray(raw) ? (raw as string[]) : (JSON.parse(String(raw ?? "[]")) as string[]);
  } catch {
    sources = [];
  }
  const hosts: string[] = [];
  for (const url of sources) {
    try {
      const host = site(new URL(url).hostname);
      if (host && !hosts.includes(host)) hosts.push(host);
    } catch {
      /* an unparseable source is not a source */
    }
  }
  if (hosts.length === 0) {
    return grade === "D" ? "no source recorded · uncorroborated" : "no source recorded";
  }
  const shown = hosts.slice(0, 3).join(", ");
  const extra = hosts.length > 3 ? ` +${hosts.length - 3}` : "";
  return `${hosts.length} source${hosts.length === 1 ? "" : "s"}: ${shown}${extra}${
    grade === "D" ? " · uncorroborated" : ""
  }`;
}

const CATEGORY: Record<string, string> = {
  war: "cost",
  arms: "cost",
  finance: "extraction",
  corruption: "extraction",
  tax: "extraction",
  labour: "precarity",
  migration: "precarity",
  climate: "precarity",
  repression: "suppression",
  media: "suppression",
  impunity: "impunity",
  courts: "impunity",
};

const SEVERITY: Record<string, number> = { A: 6, B: 5, C: 3, D: 1 };

export interface PublishReport {
  published: number;
  seen: number;
}

/** A feed id that can be derived twice and stay the same. */
function feedId(claimId: string): string {
  let h = 5381;
  for (let i = 0; i < claimId.length; i += 1) h = ((h << 5) + h + claimId.charCodeAt(i)) | 0;
  return `claim:${(h >>> 0).toString(36)}`;
}

const short = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;

/**
 * The card's label: where, when, and what the claim actually rests on.
 *
 * The byline already carries the name. Nothing here is a letter standing in
 * for a fact — the sources are named so a reader can open one.
 */
function labelFor(r: Record<string, unknown>): string {
  const place = String(r.place ?? "");
  const year = r.year ? String(Number(r.year)) : "";
  const grade = String(r.evidence_grade ?? "C");
  const pending = String(r.review_status ?? "") === "pending";
  return `${place ? `${place} · ` : ""}${year ? `${year} · ` : ""}${evidenceLine(
    r.sources,
    grade,
  )}${pending ? " · filed, awaiting review" : ""}`;
}

/** One claim, from its ledger row to a feed card. Idempotent by claim id. */
export async function publishClaim(db: LedgerDb, claimId: string): Promise<boolean> {
  const rows = await db
    .prepare(
      `SELECT id, person, act, place, year, category, act_date, evidence_grade, review_status,
              created_at, sources
         FROM ledger_entries WHERE id = ?`,
    )
    .bind(claimId)
    .all();
  const r = (rows.results ?? [])[0];
  if (!r) return false;
  const status = String(r.review_status ?? "");
  const grade = String(r.evidence_grade ?? "C");
  if (!allowed(status, grade)) return false;
  return insert(db, r);
}

function allowed(status: string, grade: string): boolean {
  if (status === "accepted" || status === "legacy") return ["A", "B", "C"].includes(grade);
  if (status === "pending") return grade === "A" || grade === "B";
  return false;
}

function insert(db: LedgerDb, r: Record<string, unknown>): Promise<boolean> {
  const claimId = String(r.id ?? "");
  const person = String(r.person ?? "");
  const act = String(r.act ?? "");
  if (!claimId || !person || !act) return Promise.resolve(false);

  const now = new Date().toISOString();
  const grade = String(r.evidence_grade ?? "C");
  const category = CATEGORY[String(r.category ?? "").toLowerCase()] ?? "impunity";
  // A year is not a date. Publishing a claim on 1 January because that is the
  // only day SQLite could invent is a fabricated fact on a news card.
  const when = /^\d{4}-\d{2}-\d{2}$/.test(String(r.act_date ?? "")) ? String(r.act_date) : now;
  const gloss = labelFor(r);
  const take = short(String(r.take ?? ""), 240);
  const write = db
    .prepare(
      `INSERT OR IGNORE INTO feed_items
        (id, kind, url, title, gloss, take, source, community, category, score, comments,
         severity, cluster, cluster_size, published_at, first_seen_at)
       VALUES (?, 'charge', ?, ?, ?, ?, 'The record', ?, ?, 0, 0, ?, ?, 1, ?, ?)`,
    )
    .bind(
      feedId(claimId),
      `/archive/claim/${encodeURIComponent(claimId)}`,
      short(act, 180),
      gloss,
      take,
      person,
      category,
      status === "pending" ? 2 : SEVERITY[grade] ?? 2,
      feedId(claimId),
      when || now,
      now,
    )
    .run()
    .then(async (res) => {
      const changed = ((res as { meta?: { changes?: number } }).meta?.changes ?? 0) > 0;
      // An existing card keeps its first_seen_at and its published date, but
      // takes the current label and take — otherwise a corrected grade note or
      // a late take never reaches the card that is already on the page.
      if (!changed) {
        await db
          .prepare(
            `UPDATE feed_items
                SET gloss = ?,
                    take = CASE WHEN ? != '' THEN ? ELSE take END
              WHERE id = ?`,
          )
          .bind(gloss, take, take, feedId(claimId))
          .run();
      }
      return changed;
    })
    .catch(() => false);

  // A card published before the take existed picks it up on the next pass.
  if (take) {
    write
      .then(() =>
        db
          .prepare("UPDATE feed_items SET take = ? WHERE id = ? AND take = ''")
          .bind(take, feedId(claimId))
          .run(),
      )
      .catch(() => undefined);
  }
  return write;
}

export async function publishClaimsToFeed(
  db: LedgerDb,
  opts: { days?: number; limit?: number } = {},
): Promise<PublishReport> {
  const days = opts.days ?? 7;
  const limit = opts.limit ?? 40;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // Cards published before Ada's take existed pick one up here, so a take
  // written late still reaches the card that is already on the page.
  try {
    await db
      .prepare(
        `UPDATE feed_items
            SET take = COALESCE((
                  SELECT le.take FROM ledger_entries le
                   WHERE '/archive/claim/' || replace(le.id, ':', '%3A') = feed_items.url
                     AND le.take IS NOT NULL AND le.take != ''
                ), '')
          WHERE kind = 'charge' AND (take IS NULL OR take = '')`,
      )
      .bind()
      .run();
  } catch {
    /* the backfill is best effort */
  }

  // Cards filed before the date rule existed carry the year's first of January
  // as if it were a fact. Nothing in the record dates those claims to a day, so
  // the card is dated when it was filed. A claim with a real 1 January act date
  // is left alone.
  try {
    await db
      .prepare(
        `UPDATE feed_items
            SET published_at = first_seen_at
          WHERE kind = 'charge'
            AND published_at LIKE '____-01-01%'
            AND NOT EXISTS (
                  SELECT 1 FROM ledger_entries le
                   WHERE '/archive/claim/' || replace(le.id, ':', '%3A') = feed_items.url
                     AND le.act_date = feed_items.published_at
                )`,
      )
      .bind()
      .run();
  } catch {
    /* the backfill is best effort */
  }

  // Cards published before the rule existed, or whose claim has no take yet,
  // come off the front page. They are not deleted from the record; the claim
  // page is still there.
  try {
    await db
      .prepare(
        `DELETE FROM feed_items
          WHERE kind = 'charge'
            AND (take IS NULL OR take = '')`,
      )
      .bind()
      .run();
  } catch {
    /* best effort */
  }

  let rows: Array<Record<string, unknown>> = [];
  try {
    const res = await db
      .prepare(
        `SELECT id, person, act, place, year, category, confidence, sources, act_date,
                evidence_grade, review_status, created_at, take
           FROM ledger_entries
          WHERE (
                  (review_status IN ('accepted', 'legacy') AND evidence_grade IN ('A', 'B', 'C'))
               OR (review_status = 'pending' AND evidence_grade IN ('A', 'B'))
                )
            -- The front page is about the line: a claim about a name nobody
            -- ranks belongs on that name's page, not on the homepage.
            AND lower(person) IN (SELECT lower(name) FROM queue_people)
            AND (created_at >= ? OR act_date >= ?)
            -- A card exists to carry the take. A claim without one is a label
            -- and a grade, which explains nothing; it stays on its own page
            -- until Ada has written the sentence that makes it mean something.
            AND take IS NOT NULL AND take != ''
          ORDER BY CASE review_status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                   created_at DESC
          LIMIT ?`,
      )
      .bind(since, since.slice(0, 10), limit)
      .all();
    rows = res.results ?? [];
  } catch {
    return { published: 0, seen: 0 };
  }

  // Existing cards take the current label and take even when the per-person
  // cap keeps a new card off the page. A corrected label must not depend on
  // winning a slot.
  for (const r of rows) {
    const claimId = String(r.id ?? "");
    if (!claimId) continue;
    const take = short(String(r.take ?? ""), 240);
    try {
      await db
        .prepare(
          `UPDATE feed_items
              SET gloss = ?,
                  take = CASE WHEN ? != '' THEN ? ELSE take END
            WHERE id = ?`,
        )
        .bind(labelFor(r), take, take, feedId(claimId))
        .run();
    } catch {
      /* best effort */
    }
  }

  // Two per person per pass. The front page is a storefront, not a file
  // cabinet: sixty claims about one chief executive would crowd out the line,
  // and the rest are already on his page.
  let published = 0;
  const perPerson = new Map<string, number>();
  for (const r of rows) {
    const who = String(r.person ?? "").toLowerCase();
    const n = perPerson.get(who) ?? 0;
    if (n >= 2) continue;
    if (await insert(db, r)) {
      published += 1;
      perPerson.set(who, n + 1);
    }
  }
  return { published, seen: rows.length };
}
