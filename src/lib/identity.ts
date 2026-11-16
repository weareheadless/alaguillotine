import type { D1 } from "@/lib/clock-store";
import { foldName, samePerson, surnameOf } from "@/lib/person-name";
import { slugify } from "@/lib/slug";

/**
 * One person, one entity, one queue row.
 *
 * The record has been written by several passes over two years, each filing
 * people under the spelling its source used: "Jeff Yass" and "Jeffrey Yass"
 * are two rows, two pages, and half a record each. The write-time matcher stops
 * new splits; this pass repairs the ones already in the table.
 *
 * It is a merge, not a rename: claims and claim links move to the surviving
 * entity, an alias records the spelling that lost, and only then is the
 * duplicate row removed. Nothing is guessed beyond `samePerson`.
 */

export interface IdentityMerge {
  canonical: string;
  merged: string[];
  claims: number;
}

export interface IdentityReport {
  groups: number;
  merged: number;
  claims: number;
  aligned: number;
  queueMerged: number;
  merges: IdentityMerge[];
}

interface Row {
  id: string;
  name: string;
}

function bestOf(rows: Row[], queueRank: Map<string, number>, claimCount: Map<string, number>): Row {
  return [...rows].sort((a, b) => {
    const qa = queueRank.get(foldName(a.name));
    const qb = queueRank.get(foldName(b.name));
    if (qa !== undefined && qb !== undefined && qa !== qb) return qa - qb;
    if (qa !== undefined && qb === undefined) return -1;
    if (qb !== undefined && qa === undefined) return 1;
    const ca = claimCount.get(a.id) ?? 0;
    const cb = claimCount.get(b.id) ?? 0;
    if (ca !== cb) return cb - ca;
    return a.name.length - b.name.length || a.name.localeCompare(b.name);
  })[0];
}

/**
 * Group person entities by identity. Surname bucket first: comparing every row
 * with every other row is four million comparisons, and the same last name is
 * the only way two spellings can pass `samePerson`.
 */
function groupEntities(
  entities: Row[],
  queueRank: Map<string, number>,
  claimCount: Map<string, number>,
): Array<{ canonical: Row; duplicates: Row[] }> {
  const bySurname = new Map<string, Row[]>();
  for (const row of entities) {
    const key = surnameOf(row.name);
    if (!key) continue;
    const bucket = bySurname.get(key) ?? [];
    bucket.push(row);
    bySurname.set(key, bucket);
  }

  const groups: Array<{ canonical: Row; duplicates: Row[] }> = [];
  for (const bucket of bySurname.values()) {
    if (bucket.length < 2) continue;
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      let at = id;
      while (parent.get(at) !== at) at = parent.get(at) as string;
      return at;
    };
    const union = (a: string, b: string): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    };
    for (const row of bucket) parent.set(row.id, row.id);
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        if (samePerson(bucket[i].name, bucket[j].name)) union(bucket[i].id, bucket[j].id);
      }
    }
    const clusters = new Map<string, Row[]>();
    for (const row of bucket) {
      const root = find(row.id);
      const list = clusters.get(root) ?? [];
      list.push(row);
      clusters.set(root, list);
    }
    for (const rows of clusters.values()) {
      if (rows.length < 2) continue;
      const canonical = bestOf(rows, queueRank, claimCount);
      groups.push({
        canonical,
        duplicates: rows.filter((row) => row.id !== canonical.id),
      });
    }
  }
  return groups;
}

export async function mergePersonIdentities(
  db: D1,
  options: { dry?: boolean } = {},
): Promise<IdentityReport> {
  const entityRows = await db
    .prepare("SELECT id, name FROM entities WHERE kind = 'person'")
    .all();
  const entities = (entityRows.results ?? [])
    .map((row) => ({ id: String(row.id ?? ""), name: String(row.name ?? "").trim() }))
    .filter((row) => row.id && row.name);

  const queueRows = await db
    .prepare("SELECT id, slug, name, rank FROM queue_people")
    .all();
  const queue = (queueRows.results ?? []).map((row) => ({
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? "").trim(),
    rank: Number(row.rank ?? 9999),
  }));
  const queueRank = new Map<string, number>();
  for (const row of queue) {
    queueRank.set(foldName(row.name), Math.min(queueRank.get(foldName(row.name)) ?? 9999, row.rank));
  }

  const countRows = await db
    .prepare("SELECT entity_id, COUNT(*) AS n FROM claims GROUP BY entity_id")
    .all();
  const claimCount = new Map<string, number>();
  for (const row of countRows.results ?? []) {
    claimCount.set(String(row.entity_id ?? ""), Number(row.n ?? 0));
  }

  const groups = groupEntities(entities, queueRank, claimCount);
  const report: IdentityReport = {
    groups: groups.length,
    merged: 0,
    claims: 0,
    aligned: 0,
    queueMerged: 0,
    merges: [],
  };

  const now = new Date().toISOString();
  for (const group of groups) {
    const { canonical, duplicates } = group;
    // A queued spelling wins the name, because the line and the person page are
    // reached by the queue's slug. The surviving entity takes that spelling so
    // the archive's name filter and the queue agree exactly.
    const queued =
      queue.find((row) => samePerson(row.name, canonical.name)) ??
      duplicates.map((row) => queue.find((q) => samePerson(q.name, row.name))).find(Boolean);
    const finalName = queued?.name ?? canonical.name;
    let moved = 0;

    for (const row of duplicates) {
      const claims = claimCount.get(row.id) ?? 0;
      moved += claims;
      if (options.dry) continue;

      await db
        .prepare("UPDATE claims SET entity_id = ? WHERE entity_id = ?")
        .bind(canonical.id, row.id)
        .run();
      await db
        .prepare("UPDATE OR IGNORE claim_entities SET entity_id = ? WHERE entity_id = ?")
        .bind(canonical.id, row.id)
        .run();
      await db
        .prepare("DELETE FROM claim_entities WHERE entity_id = ?")
        .bind(row.id)
        .run();
      await db
        .prepare(
          `INSERT INTO person_aliases (alias, canonical, note, at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(alias) DO UPDATE SET canonical = excluded.canonical`,
        )
        .bind(
          row.name.toLowerCase(),
          finalName,
          `identity pass merged "${row.name}" into "${finalName}"`,
          now,
        )
        .run();
      await db.prepare("DELETE FROM entities WHERE id = ?").bind(row.id).run();
    }

    if (!options.dry && finalName !== canonical.name) {
      await db
        .prepare("UPDATE entities SET name = ?, slug = ?, updated_at = ? WHERE id = ?")
        .bind(finalName, slugify(finalName), now, canonical.id)
        .run();
    }

    report.merged += duplicates.length;
    report.claims += moved;
    report.merges.push({
      canonical: finalName,
      merged: duplicates.map((row) => row.name),
      claims: moved,
    });
    if (report.merges.length > 60) break;
  }

  // The queue spelling is the one the line and the archive filter use. An
  // entity filed under a longer or shorter form takes the queue's name, so the
  // archive's exact match finds it without a second alias lookup.
  if (!options.dry) {
    for (const entity of entities) {
      const queued = queue.find((row) => samePerson(row.name, entity.name));
      if (!queued || foldName(queued.name) === foldName(entity.name)) continue;
      await db
        .prepare("UPDATE entities SET name = ?, slug = ?, updated_at = ? WHERE id = ?")
        .bind(queued.name, slugify(queued.name), now, entity.id)
        .run();
      await db
        .prepare(
          `INSERT INTO person_aliases (alias, canonical, note, at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(alias) DO UPDATE SET canonical = excluded.canonical`,
        )
        .bind(entity.name.toLowerCase(), queued.name, `identity pass aligned "${entity.name}"`, now)
        .run();
      report.aligned += 1;
      if (report.merges.length < 60) {
        report.merges.push({ canonical: queued.name, merged: [entity.name], claims: 0 });
      }
    }
  }

  // Two queue rows for one person split the line and the slug. Keep the better
  // rank, link the other spelling, and remove the duplicate row.
  const kept: Array<(typeof queue)[number]> = [];
  for (const row of queue.sort((a, b) => a.rank - b.rank)) {
    const twin = kept.find((other) => samePerson(other.name, row.name));
    if (!twin) {
      kept.push(row);
      continue;
    }
    report.queueMerged += 1;
    report.merges.push({ canonical: twin.name, merged: [row.name], claims: 0 });
    if (options.dry) continue;
    await db
      .prepare(
        `INSERT INTO person_aliases (alias, canonical, note, at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(alias) DO UPDATE SET canonical = excluded.canonical`,
      )
      .bind(row.name.toLowerCase(), twin.name, `identity pass merged queue row "${row.name}"`, now)
      .run();
    await db.prepare("DELETE FROM queue_people WHERE id = ?").bind(row.id).run();
  }

  return report;
}
