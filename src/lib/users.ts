/**
 * User CRUD operations — server-only module.
 * Reuses the existing getDb() singleton from local-db.ts.
 * Uses bcryptjs (pure JS) for password hashing.
 */

import { getDb } from "./local-db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_ROUNDS = 10;

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  wallet_address: string | null;
  is_guest: boolean;
  created_at: string;
}

interface UserRowWithHash extends UserRow {
  password_hash: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function rowToUser(row: UserRowWithHash): UserRow {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    wallet_address: row.wallet_address,
    is_guest: !!row.is_guest,
    created_at: row.created_at,
  };
}

// ─── Create ────────────────────────────────────────────────────────────────────

export function createUser(username: string, password: string): UserRow {
  const trimmed = username.trim().toLowerCase();

  // Validate: 3-20 chars, alphanumeric + underscore
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
    throw new Error("Username must be 3-20 characters, alphanumeric and underscores only.");
  }

  if (password.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO users (id, username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(id, trimmed, passwordHash, trimmed, now);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed: users.username")) {
      throw new Error("Username already taken. The blade rejects duplicates.");
    }
    throw err;
  }

  return { id, username: trimmed, display_name: trimmed, wallet_address: null, is_guest: false, created_at: now };
}

// ─── Guest users (anonymous posting — no password) ────────────────────────────

/**
 * Create a lightweight guest user for anonymous posting.
 * Guests get a unique generated username (never shown), the chosen display name,
 * and an unusable random password hash so they can never log in with credentials.
 */
export function createGuestUser(displayName: string): UserRow {
  const safeName = displayName.trim().slice(0, 30) || "Anonymous Spite";
  const username = `guest_${crypto.randomBytes(6).toString("hex")}`;
  // Unusable password — guests authenticate via session cookie only
  const unusableHash = bcrypt.hashSync(crypto.randomBytes(24).toString("base64url"), BCRYPT_ROUNDS);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, wallet_address, is_guest, created_at)
     VALUES (?, ?, ?, ?, NULL, 1, ?)`
  ).run(id, username, unusableHash, safeName, now);

  return { id, username, display_name: safeName, wallet_address: null, is_guest: true, created_at: now };
}

// ─── Authenticate ──────────────────────────────────────────────────────────────

export function verifyLogin(username: string, password: string): UserRow | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM users WHERE username = ?"
  ).get(username.trim().toLowerCase()) as UserRowWithHash | undefined;

  if (!row) return null;

  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) return null;

  return rowToUser(row);
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export function getUserById(id: string): UserRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRowWithHash | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserByUsername(username: string): UserRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim().toLowerCase()) as UserRowWithHash | undefined;
  return row ? rowToUser(row) : null;
}

// ─── Update ────────────────────────────────────────────────────────────────────

export function updateDisplayName(userId: string, displayName: string): void {
  const trimmed = displayName.trim().slice(0, 30);
  if (!trimmed) return;
  const db = getDb();
  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(trimmed, userId);
}

export function linkWalletAddress(userId: string, walletAddress: string): void {
  // Validate: must be a valid Solana base58 address (32-44 chars typical)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    throw new Error("Invalid wallet address format.");
  }
  const db = getDb();
  db.prepare("UPDATE users SET wallet_address = ? WHERE id = ?").run(walletAddress, userId);
}

export function getUserByWallet(walletAddress: string): UserRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE wallet_address = ?").get(walletAddress) as UserRowWithHash | undefined;
  return row ? rowToUser(row) : null;
}
