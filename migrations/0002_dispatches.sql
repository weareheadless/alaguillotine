-- Ada's dispatches: the blog, written from the same research pass.
CREATE TABLE IF NOT EXISTS dispatches (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  dek TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  published_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS dispatches_published ON dispatches (published_at DESC);

-- The queue persists. Ada adds people; they stay until the evidence does.
CREATE TABLE IF NOT EXISTS queue_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  mentions INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  prev_rank INTEGER,
  added_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS queue_rank ON queue_people (rank ASC);
