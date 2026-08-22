import { getClientIp, getSessionUserId } from "@/lib/session";

/**
 * /api/chat — server-side proxy to Ada's public chat server (127.0.0.1:3004).
 *
 * The widget never talks to Python directly; it goes through this route so the
 * OpenRouter key stays server-side and nginx never has to expose :3004.
 *
 * Identity: a logged-in user is billed under their session user id; anonymous
 * visitors are billed under a UUID they generate and send in `X-User-Id`
 * (persisted in localStorage). The chat server also rate-limits per IP as a
 * backstop.
 */

const CHAT_UPSTREAM = process.env.CHAT_UPSTREAM || "http://127.0.0.1:3004";

const ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

function sanitizeUserId(raw: string | null): string {
  if (raw && ID_RE.test(raw)) return raw;
  return "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body?.message ?? "").slice(0, 600);
    if (!message.trim()) {
      return Response.json({ ok: false, error: "empty message" }, { status: 400 });
    }

    const sessionUserId = await getSessionUserId();
    const headerUserId = sanitizeUserId(req.headers.get("x-user-id"));
    const user_id = sessionUserId || headerUserId || "";
    const name = String(body?.name ?? "").slice(0, 40);
    const ip = await getClientIp();

    const upstream = await fetch(`${CHAT_UPSTREAM}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Real-IP": ip,
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ message, user_id, name }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    const data = await upstream.json();
    return Response.json(data, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "chat failed";
    return Response.json({ ok: false, error: msg }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function GET() {
  try {
    const sessionUserId = await getSessionUserId();
    const upstream = await fetch(`${CHAT_UPSTREAM}/chat/meta?user_id=${encodeURIComponent(sessionUserId || "")}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json();
    return Response.json(data, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "meta failed";
    return Response.json({ ok: false, error: msg }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}