import {
  countRecentByIp,
  createSubmission,
  getSubmissionByCode,
  hashIp,
  type D1,
  type PublicSubmission,
} from "@/lib/submissions";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const revalidate = 0;

const MAX_PER_DAY = 2;

type Env = { D1?: D1 };

async function db(): Promise<D1 | null> {
  const context = (await getCloudflareContext({ async: true })) as unknown as {
    env?: Env;
  };
  return context.env?.D1 ?? null;
}

const clean = (value: unknown, max: number): string =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, max);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** GET /api/submissions?code=XXXXXXXX — what happened to one proposal. */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9]{6,12}$/.test(code)) {
    return Response.json({ error: "invalid code" }, { status: 400 });
  }

  const database = await db();
  if (!database) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const submission = await getSubmissionByCode(database, code);
  if (!submission) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const publicView: PublicSubmission = {
    code: submission.code,
    name: submission.name,
    role: submission.role,
    country: submission.country,
    acts: submission.acts,
    sources: submission.sources,
    why: submission.why,
    status: submission.status,
    verdict: submission.verdict,
    createdAt: submission.createdAt,
    reviewedAt: submission.reviewedAt,
  };

  return Response.json({ submission: publicView }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/submissions — propose a name.
 *
 * Free, no account, no email. Rate limited per address so one person cannot
 * flood the review queue, and a honeypot field for bots that fill forms.
 */
export async function POST(request: Request) {
  const database = await db();
  if (!database) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  // Bots love a field they can see. Humans leave it empty.
  if (clean(payload.website, 200)) {
    return Response.json({ ok: true, code: "" }, { status: 202 });
  }

  const name = clean(payload.name, 80);
  const role = clean(payload.role, 120);
  const country = clean(payload.country, 60);
  const acts = clean(payload.acts, 2000);
  const why = clean(payload.why, 600);
  const submitter = clean(payload.submitter, 60);

  const rawSources = Array.isArray(payload.sources) ? payload.sources : [];
  const sources = rawSources
    .map((s) => clean(s, 500))
    .filter((s) => isHttpUrl(s))
    .slice(0, 4);

  const errors: string[] = [];
  if (name.length < 2) errors.push("a name is required");
  if (acts.length < 40)
    errors.push("the allegation needs at least a sentence and a source");
  if (sources.length < 1)
    errors.push("at least one working source URL is required");
  if (errors.length > 0) {
    return Response.json({ error: errors.join("; ") }, { status: 400 });
  }

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ipHash = await hashIp(ip);

  const recent = await countRecentByIp(database, ipHash);
  if (recent >= MAX_PER_DAY) {
    return Response.json(
      {
        error:
          "two proposals a day is the limit. Sit with it, find another source, come back tomorrow.",
      },
      { status: 429 },
    );
  }

  const submission = await createSubmission(database, {
    name,
    role,
    country,
    acts,
    sources,
    why,
    submitter,
    ipHash,
  });

  return Response.json(
    { ok: true, code: submission.code },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}