import type { D1 } from "@/lib/clock-store";
import { foldName, nameKey, sameNameExpanded, samePerson } from "@/lib/person-name";

/**
 * The names the record already holds, and the explicit links between
 * spellings.
 *
 * Identity is a comparison, not a LIKE: the index is loaded once per pass and
 * every name is matched against it with the same rules the person page uses.
 * An approved `person_aliases` row is the lasting record of a variant, so the
 * heuristic does not have to rediscover the same spelling on every run.
 */

export interface PersonRef {
  /** The entity id claims are filed under. */
  id: string;
  /** The spelling the record already uses. */
  name: string;
}

export async function loadPersonIndex(db: D1): Promise<PersonRef[]> {
  const refs: PersonRef[] = [];
  const seen = new Set<string>();

  try {
    const entities = await db
      .prepare("SELECT id, name FROM entities WHERE kind = 'person'")
      .all();
    for (const row of entities.results ?? []) {
      const name = String(row.name ?? "").trim();
      const id = String(row.id ?? "").trim();
      if (!name || !id) continue;
      refs.push({ id, name });
      seen.add(nameKey(name));
    }
  } catch {
    /* a record with no entities yet still has a queue */
  }

  try {
    const queue = await db.prepare("SELECT slug, name FROM queue_people").all();
    for (const row of queue.results ?? []) {
      const name = String(row.name ?? "").trim();
      const slug = String(row.slug ?? "").trim();
      if (!name || !slug || seen.has(nameKey(name))) continue;
      refs.push({ id: `person:${slug}`, name });
      seen.add(nameKey(name));
    }
  } catch {
    /* queue not created yet */
  }

  return refs;
}

export function resolveInIndex(index: PersonRef[], name: string): PersonRef | null {
  const key = nameKey(name);
  const exact = index.find((ref) => nameKey(ref.name) === key);
  if (exact) return exact;
  const strict = index.find((ref) => samePerson(ref.name, name));
  if (strict) return strict;
  // A source that writes the middle name the record omitted. Only when exactly
  // one known name fits: two people called David Taylor cannot be told apart
  // by a middle initial, so neither is chosen.
  const expanded = index.filter((ref) => sameNameExpanded(name, ref.name));
  return expanded.length === 1 ? expanded[0] : null;
}

/** An approved alias links a spelling the index does not hold to its canonical. */
export async function canonicalFromAlias(db: D1, name: string): Promise<string> {
  try {
    const row = await db
      .prepare("SELECT canonical FROM person_aliases WHERE alias = ? LIMIT 1")
      .bind(name.trim().toLowerCase())
      .first<{ canonical: string }>();
    return String(row?.canonical ?? "");
  } catch {
    return "";
  }
}

/**
 * Record the spelling link, so the archive and the scorer use it without the
 * heuristic having to rediscover it on every pass. The alias table is the
 * explicit record of "these two spellings are one person"; this is how a
 * variant gets there when the machine has only the name to go on.
 */
export async function noteAlias(
  db: D1,
  observed: string,
  canonical: string,
  now: string,
): Promise<void> {
  if (foldName(observed) === foldName(canonical)) return;
  try {
    await db
      .prepare(
        `INSERT INTO person_aliases (alias, canonical, note, at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(alias) DO UPDATE SET canonical = excluded.canonical`,
      )
      .bind(observed.trim().toLowerCase(), canonical, `matched "${observed}"`, now)
      .run();
  } catch {
    /* an alias is an optimisation; the comparison still works without it */
  }
}
