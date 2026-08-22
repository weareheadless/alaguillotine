import { isAdminAuthed } from "@/lib/admin-auth";

const ADMIN_UPSTREAM = process.env.ADMIN_UPSTREAM || "http://127.0.0.1:3005";

/**
 * /api/admin/proxy/[...path] — auth-gated proxy to the private Python admin
 * API (127.0.0.1:3005). The Python server binds to localhost only; nginx never
 * exposes it. Requests that pass the admin-key gate (httpOnly cookie or
 * X-Admin-Key header) are forwarded verbatim.
 */
async function handler(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;

  if (!(await isAdminAuthed(req))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const seg = path.join("/");
  const url = new URL(req.url);
  const target = `${ADMIN_UPSTREAM}/admin/${seg}${url.search}`;

  // Chat can take a while — she may decide to observe through a tool first.
  const timeoutMs = seg === "chat" ? 300_000 : 30_000;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const upstreamKey = process.env.ADMIN_UPSTREAM_KEY || process.env.ADMIN_API_KEY || process.env.ADMIN_KEY || "";
  if (!upstreamKey) {
    return Response.json(
      { ok: false, error: "admin upstream authentication is not configured" },
      { status: 503 },
    );
  }
  headers.set("x-admin-key", upstreamKey);

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await upstream.text();
    const ct = upstream.headers.get("content-type") || "application/json";
    return new Response(data, {
      status: upstream.status,
      headers: { "Content-Type": ct, "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upstream failed";
    return Response.json(
      { ok: false, error: `admin upstream error: ${msg}` },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
