-- One findings pass at a time, from one place.
--
-- The cron keeps a cursor over the (outlet, finding word) grid so each run reads
-- a different archive search instead of starting over at ProPublica. The cursor
-- is scheduling state, not a roster: it never decides who can appear.
CREATE TABLE IF NOT EXISTS findings_cursor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO findings_cursor (id, position, updated_at)
VALUES (1, 0, datetime('now'));
