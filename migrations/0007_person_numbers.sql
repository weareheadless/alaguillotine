-- The numbers behind the name.
--
-- Every person in the line gets a small set of hard, sourced numbers: what
-- they are worth, what the public pays them, what they avoid, what their
-- record costs in lives. One row per kind, with the source and the verbatim
-- quote that supports it, so the table can show a number without asking the
-- reader to trust the machine.

CREATE TABLE IF NOT EXISTS person_numbers (
  slug TEXT NOT NULL,
  -- wealth | public_money | tax | deaths | displacement | fines |
  -- donations | layoffs | emissions | workers | profit | other
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  -- the number as a reader would say it: "$4.2B", "12,000", "38%"
  display TEXT NOT NULL,
  value REAL,
  unit TEXT NOT NULL DEFAULT '',
  year INTEGER,
  source_url TEXT NOT NULL,
  evidence_quote TEXT NOT NULL DEFAULT '',
  confidence INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL,
  PRIMARY KEY (slug, kind, label)
);

CREATE INDEX IF NOT EXISTS idx_person_numbers_slug
  ON person_numbers (slug);

-- The numbers pass has its own queue: a name can have a full dossier and no
-- numbers yet, and the search is slower than the ledger extraction.
CREATE TABLE IF NOT EXISTS numbers_runs (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  found INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  started_at TEXT,
  last_error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_numbers_runs_status
  ON numbers_runs (status, checked_at);
