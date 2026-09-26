/**
 * Local SQLite database — drop-in replacement for Appwrite Databases API.
 * Keeps the same method signatures (listDocuments, createDocument, etc.)
 * so existing code needs minimal changes.
 *
 * IMPORTANT: This module uses better-sqlite3 (native C module) and MUST
 * only be imported inside server actions ("use server") or API routes.
 * It will NOT work in browser/client components.
 */

import Database from "better-sqlite3";
import path from "path";

// ─── Singleton ──────────────────────────────────────────────────────────────────

// FYE_DB_PATH lets tests and local preview servers point at a disposable
// fixture database instead of the live one. Production leaves it unset, so
// the default remains the real DB on disk.
const DB_PATH = process.env.FYE_DB_PATH || path.join(process.cwd(), "data", "local.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    // Ensure data directory exists
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    ensureTables(_db);
  }
  return _db;
}

// ─── Schema ─────────────────────────────────────────────────────────────────────

function ensureTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL DEFAULT '',
      author_id TEXT,
      author_name TEXT NOT NULL DEFAULT 'Anonymous',
      amount_paid INTEGER NOT NULL DEFAULT 0,
      is_shadowbanned INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id);
    CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);
    CREATE INDEX IF NOT EXISTS idx_messages_shadow ON messages(is_shadowbanned);

    CREATE TABLE IF NOT EXISTS nominations (
      id TEXT PRIMARY KEY,
      target_name TEXT NOT NULL DEFAULT '',
      voter_id TEXT,
      voter_name TEXT NOT NULL DEFAULT '',
      message_id TEXT,
      weight INTEGER NOT NULL DEFAULT 1,
      amount_paid INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS epochs (
      id TEXT PRIMARY KEY,
      epoch_number INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      start_msg_count INTEGER NOT NULL DEFAULT 0,
      end_msg_count INTEGER NOT NULL DEFAULT 0,
      board_members TEXT NOT NULL DEFAULT '[]',
      treasury_amount INTEGER NOT NULL DEFAULT 0,
      unique_senders INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT '',
      voting_started_at TEXT,
      executed_at TEXT,
      final_burn INTEGER NOT NULL DEFAULT 0,
      final_lottery INTEGER NOT NULL DEFAULT 0,
      final_dev INTEGER NOT NULL DEFAULT 0,
      final_board INTEGER NOT NULL DEFAULT 0,
      final_revolution INTEGER NOT NULL DEFAULT 0,
      director_fees TEXT NOT NULL DEFAULT '{}',
      hypothesis_winner TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_epochs_status ON epochs(status);

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      epoch_id TEXT NOT NULL DEFAULT '',
      epoch_number INTEGER NOT NULL DEFAULT 1,
      voter_wallet TEXT NOT NULL DEFAULT '',
      voter_user_id TEXT NOT NULL DEFAULT '',
      burn_rate INTEGER NOT NULL DEFAULT 0,
      lottery_rate INTEGER NOT NULL DEFAULT 0,
      dev_rate INTEGER NOT NULL DEFAULT 0,
      board_rate INTEGER NOT NULL DEFAULT 0,
      revolution_rate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_votes_epoch ON votes(epoch_id);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      wallet_address TEXT,
      is_guest INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS pow_challenges (
      challenge TEXT PRIMARY KEY,
      difficulty INTEGER NOT NULL DEFAULT 4,
      created_at TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT ''
    );

    -- AI Oracle proposals (3 per epoch + 1 NONE sentinel)
    CREATE TABLE IF NOT EXISTS oracle_proposals (
      id TEXT PRIMARY KEY,
      epoch_number INTEGER NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      is_none_option INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '🔥',
      manifesto TEXT NOT NULL DEFAULT '',
      burn_pct INTEGER NOT NULL DEFAULT 0,
      bounty_pct INTEGER NOT NULL DEFAULT 0,
      infra_pct INTEGER NOT NULL DEFAULT 0,
      marketing_pct INTEGER NOT NULL DEFAULT 0,
      oracle_raw_response TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT '',
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_oracle_proposals_epoch ON oracle_proposals(epoch_number);

    -- Governance votes (one per wallet per epoch)
    CREATE TABLE IF NOT EXISTS governance_votes (
      id TEXT PRIMARY KEY,
      epoch_number INTEGER NOT NULL,
      proposal_id TEXT NOT NULL REFERENCES oracle_proposals(id),
      voter_wallet TEXT NOT NULL,
      voter_user_id TEXT,
      signature TEXT NOT NULL DEFAULT '',
      voted_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_gov_votes_epoch ON governance_votes(epoch_number);
    CREATE INDEX IF NOT EXISTS idx_gov_votes_proposal ON governance_votes(proposal_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_votes_wallet_epoch ON governance_votes(voter_wallet, epoch_number);

    -- Proposal discussion comments (DEPRECATED — replaced by war_room_posts + war_room_comments)
    CREATE TABLE IF NOT EXISTS proposal_comments (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES oracle_proposals(id),
      author_wallet TEXT NOT NULL,
      author_user_id TEXT,
      author_name TEXT NOT NULL DEFAULT 'Anonymous',
      text TEXT NOT NULL,
      is_rejected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_comments_proposal ON proposal_comments(proposal_id);

    -- ─── War Room (Reddit-style community board) ─────────────────────────────

    CREATE TABLE IF NOT EXISTS war_room_posts (
      id TEXT PRIMARY KEY,
      author_id TEXT,
      author_wallet TEXT,
      author_name TEXT NOT NULL DEFAULT 'Anonymous',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      proposal_id TEXT,
      is_sticky INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      is_removed INTEGER NOT NULL DEFAULT 0,
      upvote_count INTEGER NOT NULL DEFAULT 0,
      downvote_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_wr_posts_sticky ON war_room_posts(is_sticky);
    CREATE INDEX IF NOT EXISTS idx_wr_posts_created ON war_room_posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_wr_posts_proposal ON war_room_posts(proposal_id);

    CREATE TABLE IF NOT EXISTS war_room_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES war_room_posts(id),
      parent_id TEXT,
      author_id TEXT,
      author_wallet TEXT,
      author_name TEXT NOT NULL DEFAULT 'Anonymous',
      body TEXT NOT NULL DEFAULT '',
      is_removed INTEGER NOT NULL DEFAULT 0,
      upvote_count INTEGER NOT NULL DEFAULT 0,
      downvote_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_wr_comments_post ON war_room_comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_wr_comments_parent ON war_room_comments(parent_id);

    CREATE TABLE IF NOT EXISTS war_room_votes (
      id TEXT PRIMARY KEY,
      voter_key TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment')),
      target_id TEXT NOT NULL,
      vote INTEGER NOT NULL CHECK(vote IN (1, -1)),
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_wr_votes_unique ON war_room_votes(voter_key, target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_wr_votes_target ON war_room_votes(target_type, target_id);

    -- ─── the-guillotine v2: candidate roster ──────────────────────────────
    -- Wealth-ranked lineup. The roster IS the queue: the survivor of a race
    -- holds the board and faces the next candidate in order.
    CREATE TABLE IF NOT EXISTS roster (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      rank INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',   -- active | decapitated
      net_worth TEXT NOT NULL DEFAULT '',      -- display string ("$247B")
      emoji TEXT NOT NULL DEFAULT '🪓',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_roster_rank ON roster(rank);

    -- ─── the-guillotine v2: races ─────────────────────────────────────────
    -- One active race at a time: candidate_a vs candidate_b. A race ends when
    -- the leader's weighted lead exceeds 10% of total weighted posts — the
    -- leader is decapitated and leaves, the survivor stays for the next race.
    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      candidate_a TEXT NOT NULL,
      candidate_b TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',   -- active | over
      started_at TEXT NOT NULL DEFAULT '',
      ended_at TEXT,
      decapitated TEXT,                        -- the leader who lost their head
      survivor TEXT,                           -- the one who holds the board
      trigger_lead INTEGER NOT NULL DEFAULT 0,
      total_weight INTEGER NOT NULL DEFAULT 0,
      epoch_number INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
    CREATE INDEX IF NOT EXISTS idx_races_created ON races(created_at);
  `);

  // ─── Migrations for existing databases ────────────────────────────────

  // Guest posting rate limits (per IP, rolling window)
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

  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "is_guest")) {
    db.exec("ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
  }

  // the-guillotine v2: messages gain race + scoring columns (existing DBs).
  const msgCols = db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
  if (!msgCols.some((c) => c.name === "race_id")) {
    db.exec("ALTER TABLE messages ADD COLUMN race_id TEXT");
  }
  if (!msgCols.some((c) => c.name === "board")) {
    db.exec("ALTER TABLE messages ADD COLUMN board TEXT NOT NULL DEFAULT 'a'");
  }
  if (!msgCols.some((c) => c.name === "score")) {
    db.exec("ALTER TABLE messages ADD COLUMN score INTEGER NOT NULL DEFAULT 0");
  }
  if (!msgCols.some((c) => c.name === "highlight_expires_at")) {
    db.exec("ALTER TABLE messages ADD COLUMN highlight_expires_at TEXT");
  }

  // the-guillotine v2: seed the wealth-ranked roster and the opening race.
  // Idempotent — only seeds when empty so it never overwrites admin changes.
  const rosterCount = (db.prepare("SELECT COUNT(*) as c FROM roster").get() as { c: number }).c;
  if (rosterCount === 0) {
    const seed = db.prepare(
      "INSERT INTO roster (id, name, rank, status, net_worth, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const now = new Date().toISOString();
    const lineup: [string, string, number, string, string][] = [
      ["musk", "Musk", 1, "$247B", "🚀"],
      ["trump", "Trump", 2, "$5B", "🍊"],
      ["zuckerberg", "Zuckerberg", 3, "$190B", "🦎"],
      ["thiel", "Thiel", 4, "$12B", "🧛"],
      ["netanyahu", "Netanyahu", 5, "$13M", "🦅"],
    ];
    const tx = db.transaction(() => {
      for (const [id, name, rank, netWorth, emoji] of lineup) {
        seed.run(id, name, rank, "active", netWorth, emoji, now);
      }
    });
    tx();
  }

  const raceCount = (db.prepare("SELECT COUNT(*) as c FROM races").get() as { c: number }).c;
  if (raceCount === 0) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO races (id, candidate_a, candidate_b, status, started_at, epoch_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(`race_musk_trump_${Date.now()}`, "Musk", "Trump", "active", now, 1, now);
  }
}

// ─── Query Builder ──────────────────────────────────────────────────────────────

interface QueryParam {
  method: "equal" | "isNull" | "orderAsc" | "orderDesc" | "limit" | "greaterThanEqual" | "greaterThan" | "or";
  field?: string;
  value?: unknown;
  queries?: QueryParam[];
}

function buildWhere(q: QueryParam[]): { where: string; params: unknown[]; orderClause: string; limitClause: string } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let orderClause = "";
  let limitClause = "";

  const bind = (v: unknown): unknown => {
    if (typeof v === "boolean") return v ? 1 : 0;
    return v;
  };

  for (const item of q) {
    switch (item.method) {
      case "equal":
        conditions.push(`${item.field} = ?`);
        params.push(bind(item.value));
        break;
      case "isNull":
        conditions.push(`${item.field} IS NULL`);
        break;
      case "greaterThanEqual":
        conditions.push(`${item.field} >= ?`);
        params.push(bind(item.value));
        break;
      case "greaterThan":
        conditions.push(`${item.field} > ?`);
        params.push(bind(item.value));
        break;
      case "orderAsc":
        orderClause = `ORDER BY ${item.field} ASC`;
        break;
      case "orderDesc":
        orderClause = `ORDER BY ${item.field} DESC`;
        break;
      case "limit":
        limitClause = `LIMIT ${Number(item.value)}`;
        break;
      case "or": {
        const orParts: string[] = [];
        if (item.queries) {
          for (const orItem of item.queries) {
            if (orItem.method === "equal") {
              orParts.push(`${orItem.field} = ?`);
              params.push(bind(orItem.value));
            }
          }
        }
        if (orParts.length > 0) {
          conditions.push(`(${orParts.join(" OR ")})`);
        }
        break;
      }
    }
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
    orderClause,
    limitClause,
  };
}

// ─── Public API (mirrors Appwrite Databases) ────────────────────────────────────

function rowToDoc(row: Record<string, unknown>) {
  // Convert integer booleans back
  const doc: Record<string, unknown> = { ...row };
  if ("is_shadowbanned" in doc) doc.is_shadowbanned = !!doc.is_shadowbanned;
  return doc;
}

export interface ListResult {
  documents: Record<string, unknown>[];
  total: number;
}

export function listDocuments(
  _dbId: string,
  collection: string,
  queries: QueryParam[] = []
): { documents: LocalDocument[]; total: number } {
  const db = getDb();
  const { where, params, orderClause, limitClause } = buildWhere(queries);

  // Count total (without limit)
  const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM ${collection} ${where}`);
  const { cnt: total } = countStmt.get(...params) as { cnt: number };

  // Fetch rows
  const sql = `SELECT * FROM ${collection} ${where} ${orderClause} ${limitClause}`;
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];

  return {
    documents: rows.map((r) => ({ id: r.id as string, $id: r.id as string, ...rowToDoc(r) })),
    total,
  };
}

export interface LocalDocument {
  id: string;
  $id: string;
  [key: string]: unknown;
}

export function createDocument(
  _dbId: string,
  collection: string,
  docId: string,
  data: Record<string, unknown>
): LocalDocument {
  const db = getDb();

  // Resolve docId — support "unique()" for auto-generation
  const id = docId === "unique()" ? generateId() : docId;

  const flatData = { ...data };
  // Convert booleans to ints for SQLite
  if ("is_shadowbanned" in flatData) {
    flatData.is_shadowbanned = flatData.is_shadowbanned ? 1 : 0;
  }

  const keys = ["id", ...Object.keys(flatData)];
  const values = [id, ...Object.values(flatData)];
  const placeholders = keys.map(() => "?").join(", ");

  db.prepare(`INSERT INTO ${collection} (${keys.join(", ")}) VALUES (${placeholders})`).run(...values);

  return { id, $id: id, ...data };
}

export function getDocument(
  _dbId: string,
  collection: string,
  docId: string
): LocalDocument {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM ${collection} WHERE id = ?`).get(docId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Document not found: ${collection}/${docId}`);
  return { id: row.id as string, $id: row.id as string, ...rowToDoc(row) };
}

export function updateDocument(
  _dbId: string,
  collection: string,
  docId: string,
  data: Record<string, unknown>
): LocalDocument {
  const db = getDb();

  const flatData = { ...data };
  if ("is_shadowbanned" in flatData) {
    flatData.is_shadowbanned = flatData.is_shadowbanned ? 1 : 0;
  }

  const setClauses = Object.keys(flatData).map((k) => `${k} = ?`);
  const values = Object.values(flatData);

  db.prepare(`UPDATE ${collection} SET ${setClauses.join(", ")} WHERE id = ?`).run(...values, docId);

  return getDocument(_dbId, collection, docId);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

let _counter = 0;
function generateId(): string {
  _counter++;
  return `local_${Date.now()}_${_counter}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Query factory (compatible with Appwrite Query import) ─────────────────────

export const Query = {
  equal: (field: string, value: unknown): QueryParam => ({ method: "equal", field, value }),
  isNull: (field: string): QueryParam => ({ method: "isNull", field }),
  orderAsc: (field: string): QueryParam => ({ method: "orderAsc", field }),
  orderDesc: (field: string): QueryParam => ({ method: "orderDesc", field }),
  limit: (n: number): QueryParam => ({ method: "limit", value: n }),
  greaterThanEqual: (field: string, value: unknown): QueryParam => ({ method: "greaterThanEqual", field, value }),
  greaterThan: (field: string, value: unknown): QueryParam => ({ method: "greaterThan", field, value }),
  or: (queries: QueryParam[]): QueryParam => ({ method: "or", queries }),
};

// Named export class to match Appwrite's `new Databases(client)` pattern
export class LocalDatabases {
  listDocuments(dbId: string, collection: string, queries?: QueryParam[]) {
    return listDocuments(dbId, collection, queries);
  }
  createDocument(dbId: string, collection: string, docId: string, data: Record<string, unknown>): LocalDocument {
    return createDocument(dbId, collection, docId, data);
  }
  getDocument(dbId: string, collection: string, docId: string): LocalDocument {
    return getDocument(dbId, collection, docId);
  }
  updateDocument(dbId: string, collection: string, docId: string, data: Record<string, unknown>): LocalDocument {
    return updateDocument(dbId, collection, docId, data);
  }
}
