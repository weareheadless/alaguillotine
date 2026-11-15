-- The claim, with the artifact under it.
--
-- ledger_entries was a sentence with an array of URLs. A claim here is the same
-- sentence, but it must belong to an entity, and it holds no authority of its
-- own: the documents table holds what was read, claim_documents holds the
-- passage, and status says what that passage establishes. Nothing in this table
-- can be upgraded by being repeated.
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  act TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  mechanism TEXT NOT NULL DEFAULT '',
  beneficiary TEXT NOT NULL DEFAULT '',
  act_date TEXT,
  date_precision TEXT NOT NULL DEFAULT 'year',
  -- Documented magnitude. Zero when the claim moved no money.
  amount REAL,
  currency TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  confidence_basis TEXT NOT NULL DEFAULT '',
  -- legacy | alleged | reported | recorded | found | admitted | superseded
  status TEXT NOT NULL DEFAULT 'legacy',
  -- entity + normalised act + date: re-extraction updates, never duplicates.
  claim_key TEXT NOT NULL,
  supersedes TEXT,
  legacy_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS claims_key ON claims (claim_key);
CREATE INDEX IF NOT EXISTS claims_entity ON claims (entity_id, act_date DESC);
CREATE INDEX IF NOT EXISTS claims_status ON claims (status, confidence DESC);

-- The text we verified against, bounded. A document is stored once, not once
-- per claim, and the excerpt is what a quote is checked against.
ALTER TABLE documents ADD COLUMN text_excerpt TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN fetched_at TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN http_status INTEGER NOT NULL DEFAULT 0;

-- Every job leaves a row. A missing cycle is a gap, not a quiet afternoon.
CREATE TABLE IF NOT EXISTS register_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  rows INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS register_runs_job ON register_runs (job, started_at DESC);
