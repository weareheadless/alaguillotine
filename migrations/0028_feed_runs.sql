-- Did the feed actually run, and how long did it take?
--
-- A cron that silently dies leaves a feed that looks merely quiet. Each pass
-- now writes a row when it starts and finishes, so a missing cycle is a gap in
-- the table rather than a suspicion.
CREATE TABLE IF NOT EXISTS feed_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'cron',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  added INTEGER NOT NULL DEFAULT 0,
  glossed INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS feed_runs_started ON feed_runs (started_at DESC);
