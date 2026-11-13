-- The roll-call judge.
--
-- Every roll call is read once and classified: does a Yea on this motion move
-- force, money for force, or the accountability for force — and how much of it
-- is the individual member's? The verdict is cached so a vote is judged once,
-- audited in the open, and never re-rolled on a whim.
CREATE TABLE IF NOT EXISTS vote_verdicts (
  key TEXT PRIMARY KEY,
  chamber TEXT NOT NULL DEFAULT 'house',
  roll INTEGER NOT NULL,
  year INTEGER NOT NULL,
  bill TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  verdict TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS vote_verdicts_at ON vote_verdicts (at DESC);

-- How much of an act is the named person's own.
--
-- A Yea on a 435-member defence authorisation is one vote among hundreds; a Yea
-- on the motion to table an impeachment is the member's own hand on the thing.
-- The judge sets this per roll, and the score multiplies by it. Existing acts
-- default to 1: nothing already filed gets quietly discounted.
ALTER TABLE ledger_entries ADD COLUMN attribution REAL NOT NULL DEFAULT 1;
