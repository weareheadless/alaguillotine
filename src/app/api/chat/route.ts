import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * /api/chat — proxy to Ada's chat server on the VPS.
 *
 * She is not reimplemented here. The Worker is the public face; the mind and the
 * memory stay on the VPS, behind an nginx location that only accepts the
 * Worker's shared key. If the VPS is unreachable the widget gets a clean error,
 * not a fake Ada.
 *
 * Identity: visitors are billed under a UUID they generate and send in
 * `X-User-Id` (persisted in localStorage). There is no local account any more;
 * the forum holds the only login. The chat server also rate-limits per IP.
 */

type ChatEnv = {
  CHAT_UPSTREAM?: string;
  ADA_KEY?: string;
};

async function upstream(): Promise<{ base: string; key: string }> {
  const ctx = (await getCloudflareContext({ async: true })) as { env?: ChatEnv };
  return {
    base:
      ctx.env?.CHAT_UPSTREAM ||
      process.env.CHAT_UPSTREAM ||
      "https://api.helloada.app/ada",
    key: ctx.env?.ADA_KEY || process.env.ADA_KEY || "",
  };
}

const ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

function sanitizeUserId(raw: string | null): string {
  if (raw && ID_RE.test(raw)) return raw;
  return "";
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body?.message ?? "").slice(0, 600);
    if (!message.trim()) {
      return Response.json({ ok: false, error: "empty message" }, { status: 400 });
    }

    const user_id = sanitizeUserId(req.headers.get("x-user-id"));
    const name = String(body?.name ?? "").slice(0, 40);
    const ip = clientIp(req);
    const { base, key } = await upstream();

    const upstreamRes = await fetch(`${base}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Real-IP": ip,
        "X-Forwarded-For": ip,
        ...(key ? { "X-Ada-Key": key } : {}),
      },
      body: JSON.stringify({ message, user_id, name }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    const data = await upstreamRes.json();
    return Response.json(data, {
      status: upstreamRes.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "chat failed";
    return Response.json(
      { ok: false, error: msg, offline: true },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(req: Request) {
  try {
    const user_id = sanitizeUserId(req.headers.get("x-user-id"));
    const { base, key } = await upstream();
    const upstreamRes = await fetch(
      `${base}/chat/meta?user_id=${encodeURIComponent(user_id)}`,
      {
        cache: "no-store",
        headers: key ? { "X-Ada-Key": key } : undefined,
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await upstreamRes.json();
    return Response.json(data, {
      status: upstreamRes.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "meta failed";
    return Response.json(
      { ok: false, error: msg, offline: true },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
