-- The citation check.
--
-- A human reviewer cannot manufacture proof either: what makes a claim stand
-- is whether the page it cites says what the claim says. That check is
-- mechanical, so it is done mechanically — fetch the source, look for the
-- person, the figures and the distinctive terms of the sentence, and record
-- what matched. A pass is not a verdict on the world; it is a verdict on the
-- citation.

ALTER TABLE ledger_entries ADD COLUMN citation_checked_at TEXT;
ALTER TABLE ledger_entries ADD COLUMN citation_note TEXT;

CREATE INDEX IF NOT EXISTS ledger_citation_check
  ON ledger_entries (review_status, citation_checked_at);
