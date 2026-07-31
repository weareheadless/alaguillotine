/**
 * Test the guest-posting DB changes (is_guest migration + guest_posts table)
 * against a COPY of the live database so the real DB is never touched.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const liveDb = path.join(process.cwd(), "data", "local.db");
const tmp = path.join(os.tmpdir(), `fye-guest-test-${crypto.randomBytes(4).toString("hex")}.db`);
fs.copyFileSync(liveDb, tmp);

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
  } else {
    console.log(`  ❌ ${msg}`);
    failures++;
  }
}

const db = new Database(tmp);
db.pragma("journal_mode = WAL");

// ── Replicate ensureTables migrations (from src/lib/local-db.ts) ──────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS guest_posts (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'message',
    message_id TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_guest_posts_ip_time ON guest_posts(ip, created_at);
`);

const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("is_guest")) {
  db.exec("ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
}

console.log("┌─ Schema migration on existing DB ─");
assert(cols.includes("is_guest") || db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "is_guest"), "users.is_guest column exists");
const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
assert(tableNames.includes("guest_posts"), "guest_posts table created");

// ── Replicate createGuestUser ─────────────────────────────────────────────────
console.log("┌─ createGuestUser ─");
const name = "RedditAnon_42";
const username = `guest_${crypto.randomBytes(6).toString("hex")}`;
const unusableHash = crypto.randomBytes(24).toString("base64url");
const id = crypto.randomUUID();
const now = new Date().toISOString();
db.prepare(
  `INSERT INTO users (id, username, password_hash, display_name, wallet_address, is_guest, created_at)
   VALUES (?, ?, ?, ?, NULL, 1, ?)`
).run(id, username, unusableHash, name, now);
const guest = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
assert(guest && guest.is_guest === 1, "guest user inserted with is_guest=1");
assert(guest.username.startsWith("guest_"), "guest username is generated (guest_...)");
assert(guest.password_hash === unusableHash, "guest password is unusable random");

// ── Replicate rate-limit queries ──────────────────────────────────────────────
console.log("┌─ Guest rate limiting ─");
function guestPostsInWindow(ip, kind, windowHours) {
  const row = db.prepare(
    `SELECT COUNT(*) as n FROM guest_posts WHERE ip = ? AND kind = ? AND created_at > datetime('now', ?)`
  ).get(ip, kind, `-${windowHours} hours`);
  return row.n;
}
function logGuestPost(ip, kind, messageId) {
  db.prepare(
    `INSERT INTO guest_posts (id, ip, kind, message_id, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), ip, kind, messageId, new Date().toISOString());
}

for (let i = 0; i < 3; i++) logGuestPost("1.2.3.4", "message", `m${i}`);
assert(guestPostsInWindow("1.2.3.4", "message", 1) === 3, "counts 3 messages in window");
assert(guestPostsInWindow("5.6.7.8", "message", 1) === 0, "different IP counts 0");
logGuestPost("1.2.3.4", "comment", "c1");
assert(guestPostsInWindow("1.2.3.4", "comment", 1) === 1, "comment kind tracked separately");

// ── Existing messages table unaffected ────────────────────────────────────────
console.log("┌─ Backward compatibility ─");
const msgCount = db.prepare("SELECT COUNT(*) as n FROM messages").get().n;
assert(typeof msgCount === "number" && msgCount >= 0, `messages table intact (${msgCount} rows)`);

db.close();
fs.rmSync(tmp, { force: true });
fs.rmSync(`${tmp}-wal`, { force: true });
fs.rmSync(`${tmp}-shm`, { force: true });

console.log("");
if (failures === 0) {
  console.log("ALL TESTS PASSED ✅");
} else {
  console.log(`${failures} FAILURE(S) ❌`);
  process.exit(1);
}
