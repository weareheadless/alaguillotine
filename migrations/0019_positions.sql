-- What they were, and when.
--
-- Every page so far says what a person did and what they were paid, in two
-- lists that never meet. The join is the point: a payment has a date, a
-- position has a term, and whether they overlap is arithmetic, not opinion.
--
--   state   an office, a ministry, an official assignment
--   firm    a company they run
--   fund    a sovereign or private fund they chair
--
-- from_date and to_date are the term, not the appointment announcement. An open
-- term (to_date NULL) means the role was still held at the last check.
-- date_precision records how much of the date the source actually gives, so a
-- bare year is not drawn like a sworn-in day.
--
-- The table answers one question — who was what, when — and nothing else. It
-- carries no judgement, which is why it can be checked by anyone.

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  person TEXT NOT NULL,
  role TEXT NOT NULL,
  org TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'state',
  from_date TEXT NOT NULL,
  to_date TEXT,
  date_precision TEXT NOT NULL DEFAULT 'day',
  source_url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS positions_person ON positions (slug, from_date);
