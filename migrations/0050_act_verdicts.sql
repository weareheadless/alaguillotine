-- A judgment is not a regular expression.
--
-- The rule that reads a sentence for an act by a named person is a model call,
-- and the call is cached here so a sentence is judged once and can be read,
-- argued with and re-run. The category and the reason are stored with it: the
-- archive shows what the judge decided, not only that it decided.
CREATE TABLE IF NOT EXISTS act_verdicts (
  act_key TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  harm TEXT NOT NULL,
  category TEXT NOT NULL,
  why TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
