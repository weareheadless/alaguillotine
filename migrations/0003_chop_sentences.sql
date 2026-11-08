-- The sentence and the countdown.
--
-- A name that reaches the threshold is not chopped on the spot: it is
-- sentenced, and the blade falls when its countdown reaches zero. One
-- execution at a time, with a cooling window between them, so the line moves
-- like a ritual and not like a batch job.
CREATE TABLE IF NOT EXISTS chop_sentences (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  person TEXT NOT NULL,
  score REAL NOT NULL,
  sentenced_at TEXT NOT NULL,
  execute_at TEXT NOT NULL,
  executed_at TEXT
);
CREATE INDEX IF NOT EXISTS chop_sentences_pending ON chop_sentences (execute_at ASC);
