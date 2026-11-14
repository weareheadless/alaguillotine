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

/** One claim, from its ledger row to a feed card. Idempotent by claim id. */
export async function publishClaim(db: LedgerDb, claimId: string): Promise<boolean> {
  const rows = await db
    .prepare(
      `SELECT id, person, act, place, year, category, act_date, evidence_grade, review_status, created_at
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

  const grade = String(r.evidence_grade ?? "C");
  const category = CATEGORY[String(r.category ?? "").toLowerCase()] ?? "impunity";
  const when = String(r.act_date ?? "") || (r.year ? `${Number(r.year)}-01-01` : "");
  const place = String(r.place ?? "");
  const status = String(r.review_status ?? "");
  const now = new Date().toISOString();

  const gloss = `${person}${place ? ` · ${place}` : ""} · grade ${grade}${
    status === "pending" ? " · filed, awaiting review" : status === "legacy" ? "" : " · reviewed"
  }`;

  return db
    .prepare(
      `INSERT OR IGNORE INTO feed_items
        (id, kind, url, title, gloss, source, community, category, score, comments,
         severity, cluster, cluster_size, published_at, first_seen_at)
       VALUES (?, 'charge', ?, ?, ?, 'The record', ?, ?, 0, 0, ?, ?, 1, ?, ?)`,
    )
    .bind(
      feedId(claimId),
      `/archive/claim/${encodeURIComponent(claimId)}`,
      short(act, 180),
      gloss,
      person,
      category,
      status === "pending" ? 2 : SEVERITY[grade] ?? 2,
      feedId(claimId),
      when || now,
      now,
    )
    .run()
    .then((res) => ((res as { meta?: { changes?: number } }).meta?.changes ?? 0) > 0)
    .catch(() => false);
}

export async function publishClaimsToFeed(
  db: LedgerDb,
  opts: { days?: number; limit?: number } = {},
): Promise<PublishReport> {
  const days = opts.days ?? 7;
  const limit = opts.limit ?? 40;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let rows: Array<Record<string, unknown>> = [];
  try {
    const res = await db
      .prepare(
        `SELECT id, person, act, place, year, category, confidence, sources, act_date,
                evidence_grade, review_status, created_at
           FROM ledger_entries
          WHERE (
                  (review_status IN ('accepted', 'legacy') AND evidence_grade IN ('A', 'B', 'C'))
               OR (review_status = 'pending' AND evidence_grade IN ('A', 'B'))
                )
            -- The front page is about the line: a claim about a name nobody
            -- ranks belongs on that name's page, not on the homepage.
            AND lower(person) IN (SELECT lower(name) FROM queue_people)
            AND (created_at >= ? OR act_date >= ?)
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
