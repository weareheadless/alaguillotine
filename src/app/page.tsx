import { getDb } from "@/lib/clock-store";
import { buildHateState } from "@/lib/hate-state";
import { emptyHate } from "@/lib/hateometer";
import { HomePage } from "./home-client";

/**
 * The front page.
 *
 * The record is the page, so it is built before the page is sent: the server
 * reads the queue, the counters and the appointment, and the HTML a reader
 * gets already has the names and the numbers. It used to arrive as a shell and
 * fill in after JavaScript fetched 300 KB, which is why the site looked slow
 * and why a deploy halfway through a session left a reader with a page whose
 * scripts no longer existed.
 *
 * Dynamic on purpose: a reading is the thing that changes, and a cached one
 * would be a lie about the line.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  let initial = emptyHate();
  try {
    const db = await getDb();
    if (db) initial = await buildHateState(db);
  } catch (error) {
    // The page still renders: the client can retry, and a stale shell is
    // better than a stack trace on the front page.
    console.error(
      "home_read_failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
  return <HomePage initial={initial} />;
}
