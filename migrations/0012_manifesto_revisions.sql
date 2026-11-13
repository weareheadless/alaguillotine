-- The manifesto is a document with versions, not a sentence that is
-- overwritten. Every rewrite appends a row; the current text is the last one.
CREATE TABLE IF NOT EXISTS manifesto_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS manifesto_revisions_created
  ON manifesto_revisions (created_at DESC);

-- Seed the version standing today, so the history starts from what visitors
-- have actually been reading rather than from the next rewrite.
INSERT INTO manifesto_revisions (body, created_at)
SELECT body, updated_at FROM manifesto
WHERE id = 'current'
  AND NOT EXISTS (SELECT 1 FROM manifesto_revisions);
