/**
 * Session management — server-only module.
 * Sessions are stored in SQLite (survives restarts).
 * Session token is a random hex string in an HTTP-only cookie.
 *
 * ⚠️ Next.js 15: cookies() is async — must be awaited.
 */

import { cookies, headers } from "next/headers";
import { getDb } from "./local-db";
import crypto from "crypto";

export const SESSION_COOKIE = "fye_session";
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days

// ─── Client IP (for guest rate limiting) ──────────────────────────────────────

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SEC * 1000);

  const db = getDb();
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now.toISOString(), expiresAt.toISOString());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });

  return token;
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const row = db.prepare(
    "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(token) as { user_id: string } | undefined;

  return row?.user_id ?? null;
}

// ─── Destroy ───────────────────────────────────────────────────────────────────

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
  }
  cookieStore.delete(SESSION_COOKIE);
}

// ─── Cleanup ───────────────────────────────────────────────────────────────────

export function purgeExpiredSessions(): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}
