-- What they declared on the way in, and on the way out.
--
-- The wealth question could not be answered from Forbes snapshots: one figure,
-- undated, about a man who may never have been on a list. Most democracies
-- compel the answer. A minister, a president, a member of Congress files a
-- statement of assets at the start of the job and again at the end, and in
-- France the Haute Autorité publishes it.
--
--   kind        assets | income | interests
--   filed_at    when the declaration was deposited
--   period_*    what period it covers
--   assets/debts/net   the figures the document gives
--   value_low/high     when the source gives a band instead of a figure
--                      (a US OGE-278 says "$1,000,001 – $5,000,000")
--
-- A band and a figure are not the same claim, so both columns exist and the
-- page draws a corridor for one and a step for the other.

CREATE TABLE IF NOT EXISTS declarations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  person TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  kind TEXT NOT NULL,
  filed_at TEXT,
  period_from TEXT,
  period_to TEXT,
  assets REAL,
  debts REAL,
  net REAL,
  income REAL,
  value_low REAL,
  value_high REAL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  source_url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS declarations_person ON declarations (slug, period_to);
