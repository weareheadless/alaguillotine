-- Every name in the line gets one full first look, on the record.
--
-- The queue can fill faster than the standing-list dossiers reach it, so a
-- name could stand there for weeks with nothing but the wire item that put them
-- there. This table registers each queue name once, runs a bounded dossier
-- pass, and records the outcome — including "nothing found", which is still an
-- investigation.

CREATE TABLE IF NOT EXISTS name_investigations (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- pending | running | done | failed
  status TEXT NOT NULL DEFAULT 'pending',
  -- 0: no ledger at all; 1: already has a record
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  -- entries newly written to the ledger by the first look
  entries INTEGER NOT NULL DEFAULT 0,
  -- entries the model extracted before deduplication
  found INTEGER NOT NULL DEFAULT 0,
  queries INTEGER NOT NULL DEFAULT 0,
  sources INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  started_at TEXT,
  last_error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_investigations_queue
  ON name_investigations (status, priority, checked_at);
