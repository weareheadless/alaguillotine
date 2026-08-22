import { isAdminAuthed } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const authed = await isAdminAuthed(req);
  return Response.json({ authed }, { headers: { "Cache-Control": "no-store" } });
}
