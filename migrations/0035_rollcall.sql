-- The roll call as fields, not as prose.
--
-- Four thousand four hundred claims in the archive say "Voted Yea — H.R. 2670
-- … roll call 723". That is the largest and best-sourced block in the record,
-- and it has never had a passage under it, because a member-by-member vote is
-- not a sentence. Reading the Clerk's XML as prose produced the worst false
-- verification of the migration: the surname is in the member list, the bill
-- number is in the header, and the "quote" was the page header.
--
-- So the vote is parsed into its fields. A roll call has a chamber, a congress,
-- a roll number, a question, a result and a date; each legislator in it has a
-- bioguide id, a party, a state and a vote. The claim then compares its own
-- sentence against those fields, and the passage it stores is the exact
-- <recorded-vote> fragment the vote was read from.

ALTER TABLE documents ADD COLUMN parsed_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS roll_calls (
  document_id TEXT PRIMARY KEY,
  congress INTEGER NOT NULL DEFAULT 0,
  session TEXT NOT NULL DEFAULT '',
  chamber TEXT NOT NULL DEFAULT '',
  roll INTEGER NOT NULL DEFAULT 0,
  legislation TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  action_date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  parsed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS roll_calls_measure ON roll_calls (legislation, action_date);

CREATE TABLE IF NOT EXISTS roll_votes (
  document_id TEXT NOT NULL,
  -- Bioguide. The id the rest of the register joins on.
  name_id TEXT NOT NULL,
  sort_name TEXT NOT NULL DEFAULT '',
  party TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  vote TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (document_id, name_id)
);
CREATE INDEX IF NOT EXISTS roll_votes_member ON roll_votes (name_id, vote);
