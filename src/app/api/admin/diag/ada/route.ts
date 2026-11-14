import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/diag/ada — what Ada's bridge actually answers.
 *
 * Every research pass used to call this endpoint, wait, and fall back without
 * saying what happened; "she is down" was a guess. This makes one authenticated
 * call with a tiny payload and reports the status, the time, the content type
 * and whether the body parses as JSON. The key is never returned.
 */
export async function GET(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: { ADA_KEY?: string; CHAT_UPSTREAM?: string };
  };
  const key = context.env?.ADA_KEY ?? "";
  const base = context.env?.CHAT_UPSTREAM || "https://api.helloada.app/ada";
  if (!key) return Response.json({ error: "ADA_KEY not configured" }, { status: 500 });

  // `results` is required and must be non-empty: a bridge that refuses an empty
  // wire tells you nothing about a real pass. `?n=` sends n synthetic results
  // of realistic size, so a size limit and a schema mismatch look different.
  const n = Math.min(60, Math.max(1, Number(new URL(request.url).searchParams.get("n") ?? 1)));
  const results = Array.from({ length: n }, (_, index) => ({
    index,
    topic: "health",
    lang: "en",
    title: `Health check item ${index}`,
    site: "example.org",
    date: new Date().toISOString().slice(0, 10),
    summary:
      "A synthetic result of realistic length used only to confirm the bridge answers. ".repeat(9).slice(0, 700),
  }));

  const payload = {
    items: [
      {
        headline: "health check",
        fact: "A single item to confirm the bridge answers.",
        quip: "checking the wiring",
        dimension: "war",
        harm: 1,
        source_index: 0,
      },
    ],
    queue: [],
    standingRecord: [],
    results,
  };

  const started = Date.now();
  try {
    const res = await fetch(`${base}/judge`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Ada-Key": key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let parses = false;
    let shape: string[] = [];
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      parses = true;
      shape = Object.keys(json).slice(0, 10);
    } catch {
      parses = false;
    }
    return Response.json(
      {
        base,
        status: res.status,
        ok: res.ok,
        ms,
        contentType: res.headers.get("content-type"),
        bytes: text.length,
        parses,
        shape,
        // A short prefix is enough to tell an HTML error page from a JSON
        // refusal, and it carries no key.
        body: text.slice(0, 240),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        base,
        error: error instanceof Error ? error.message : "unknown",
        ms: Date.now() - started,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
