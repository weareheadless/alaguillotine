import { getDb } from "@/lib/local-db";

/**
 * GET /api/epoch — current active/voting epoch number.
 * Used by the static blog's navbar so it can render the same EPOCH badge as
 * the main site (whose React navbar fetches this from a server action).
 */
export async function GET() {
  try {
    const db = getDb();
    const row = db
      .prepare(
        "SELECT epoch_number FROM epochs WHERE status IN ('active','voting') ORDER BY started_at DESC LIMIT 1"
      )
      .get() as { epoch_number: number } | undefined;
    return Response.json(
      { epoch_number: row?.epoch_number ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { epoch_number: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}