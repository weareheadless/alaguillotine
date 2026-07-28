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

const DB_PATH = path.join(process.cwd(), "data", "local.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
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
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_votes_epoch ON votes(epoch_id);
  `);
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
    documents: rows.map((r) => ({ id: r.id as string, ...rowToDoc(r) })),
    total,
  };
}

export interface LocalDocument {
  id: string;
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

  return { id, ...data };
}

export function getDocument(
  _dbId: string,
  collection: string,
  docId: string
): LocalDocument {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM ${collection} WHERE id = ?`).get(docId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Document not found: ${collection}/${docId}`);
  return { id: row.id as string, ...rowToDoc(row) };
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
