-- Discovery has its own cursor so the line pass and the new-name pass do not
-- take each other's place in the grid.
CREATE TABLE IF NOT EXISTS discovery_cursor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO discovery_cursor (id, position, updated_at)
VALUES (1, 0, datetime('now'));
