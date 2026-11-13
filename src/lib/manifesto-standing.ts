import { chargeStats } from "./archive-store";
import { COOLDOWN_DAYS } from "./evidence";
import { getDb, listChops, readQueue, readSentence } from "./hate-store";

/**
 * The line as it stands right now.
 *
 * The manifesto used to be all principle: how the number is made, why the blade
 * exists, what she will not do. True, and unaccountable — nothing on the page
 * could be checked against the site the reader was on. This is the missing half:
 * who is in the line, how much record they carry, who is serving a chop, and
 * whether a blade is already scheduled. Read from the tables, never written by
 * a model.
 */
export interface Standing {
  names: number;
  receipts: number;
  filedToday: number;
  chopped: number;
  cooling: number;
  sentence: { person: string; executeAt: string } | null;
  at: string;
}

export async function readStanding(): Promise<Standing> {
  const db = await getDb();
  const [stats, queue, chops, sentence] = await Promise.all([
    chargeStats(),
    db ? readQueue(db) : Promise.resolve([]),
    db ? listChops(db) : Promise.resolve([]),
    db ? readSentence(db) : Promise.resolve(null),
  ]);

  const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const cooling = chops.filter((c) => {
    const at = Date.parse(c.lastAt);
    return Number.isFinite(at) && at >= cutoff;
  }).length;

  return {
    names: queue.length,
    receipts: stats.total,
    filedToday: stats.last24h,
    chopped: chops.length,
    cooling,
    sentence: sentence ? { person: sentence.person, executeAt: sentence.executeAt } : null,
    at: new Date().toISOString(),
  };
}
