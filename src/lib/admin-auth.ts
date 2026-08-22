import { cookies } from "next/headers";

export const ADMIN_COOKIE = "fye_admin";

export function getAdminKey(): string {
  return process.env.ADMIN_KEY ?? "";
}

export async function isAdminAuthed(req: Request): Promise<boolean> {
  const key = getAdminKey();
  if (!key || key.length < 16) return false;

  const header = req.headers.get("x-admin-key");
  if (header && header === key) return true;

  const store = await cookies();
  const c = store.get(ADMIN_COOKIE);
  return !!c && c.value === key;
}

export async function setAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, getAdminKey(), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
