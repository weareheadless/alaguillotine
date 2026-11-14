import { isAdminAuthed } from "@/lib/admin-auth";
import { getLedgerEntry } from "@/lib/archive-store";

export const dynamic = "force-dynamic";

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * POST /api/admin/evidence/check — does the linked page still say this?
 *
 * Mechanical corroboration only: the page answers, and the text it returns
 * carries the person's surname and one of the act's figures. It does not decide
 * whether the claim is right, and it never writes a review status; it tells the
 * editor what they will find when they open the link, and catches the dead and
 * rewritten sources before an hour of reading is spent on them.
 */
export async function POST(request: Request) {
  if (!(await isAdminAuthed(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const row = await getLedgerEntry(id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  const url = row.sources[0];
  if (!url) return Response.json({ ok: false, error: "no source attached" }, { status: 400 });

  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; ALaGuillotine evidence check)",
      },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    const hay = fold(text);
    const surname = fold(row.person.split(/\s+/).filter((p) => p.length > 2).pop() ?? "");
    const figures = (row.act.match(/\d[\d,.]*/g) ?? [])
      .map((n) => n.replace(/[.,]$/, ""))
      .filter((n) => n.length >= 3);
    const figureHits = figures.filter((n) => hay.includes(fold(n)));

    // A paywall, a bot wall and a dead page are three different answers, and
    // only one of them says anything about the claim.
    const blocked = [401, 403, 429, 451, 503].includes(res.status);
    return Response.json(
      {
        ok: res.ok,
        url,
        status: res.status,
        blocked,
        ms: Date.now() - started,
        bytes: text.length,
        checks: {
          pageAnswers: res.ok,
          mentionsPerson: res.ok && surname ? hay.includes(surname) : false,
          figures: figures.slice(0, 5),
          figuresFound: res.ok ? figureHits : [],
          figureMatch: !res.ok || figures.length === 0 ? null : figureHits.length > 0,
        },
        note: blocked
          ? "The site refuses automated checks. Open it yourself; this is not evidence that the claim is wrong."
          : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        url,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : "fetch failed",
      },
      { status: 200 },
    );
  }
}
