import type { D1 } from "@/lib/clock-store";

/**
 * Recompute a universe's three statuses from the record.
 *
 * The status on `universe_members` is a cache of a query, not an opinion. It is
 * recomputed from claims and documents so a body that has just been read stops
 * saying "listed" and one whose documents are removed stops claiming to have
 * been read.
 */
const GROUNDED = `cd.quote != '' AND c.status NOT IN ('legacy', 'refuted', 'alleged')`;

export async function recomputeUniverseStatus(db: D1, universeId: string): Promise<void> {
  await db
    .prepare("UPDATE universe_members SET status = 'listed' WHERE universe_id = ?")
    .bind(universeId)
    .run();

  await db
    .prepare(
      `UPDATE universe_members SET status = 'read'
        WHERE universe_id = ? AND entity_id IN (
          SELECT DISTINCT c.entity_id FROM claims c
            JOIN claim_documents cd ON cd.claim_id = c.id
            JOIN documents d ON d.id = cd.document_id
           WHERE ${GROUNDED})`,
    )
    .bind(universeId)
    .run();

  await db
    .prepare(
      `UPDATE universe_members SET status = 'documented'
        WHERE universe_id = ? AND entity_id IN (
          SELECT DISTINCT c.entity_id FROM claims c
            JOIN claim_documents cd ON cd.claim_id = c.id
            JOIN documents d ON d.id = cd.document_id
           WHERE ${GROUNDED} AND d.kind != 'roll_call')`,
    )
    .bind(universeId)
    .run();

  await db
    .prepare(
      `UPDATE universe_members SET status = 'accused'
        WHERE universe_id = ? AND entity_id IN (
          SELECT DISTINCT c.entity_id FROM claims c
            JOIN claim_documents cd ON cd.claim_id = c.id
            JOIN documents d ON d.id = cd.document_id
           WHERE ${GROUNDED} AND d.kind IN ('press', 'register'))`,
    )
    .bind(universeId)
    .run();
}
