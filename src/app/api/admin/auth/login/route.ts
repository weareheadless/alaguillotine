import { getAdminKey, setAdminCookie } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const key = String(body?.key ?? "");
    if (!key || key !== getAdminKey()) {
      return Response.json({ ok: false, error: "bad key" }, { status: 401 });
    }
    await setAdminCookie();
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "login failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
