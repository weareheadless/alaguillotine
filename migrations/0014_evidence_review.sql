-- Evidence review: what is claimed, what is accepted, and why.
--
-- Until now every row in ledger_entries counted the same. A dossier finding, an
-- automatic receipt filed from a headline and a sanctions listing whose date is
-- the enforcement date all scored. This separates the record from the claim:
-- nothing is deleted, but only reviewed evidence moves a number.

ALTER TABLE ledger_entries ADD COLUMN review_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE ledger_entries ADD COLUMN reviewed_at TEXT;
ALTER TABLE ledger_entries ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
-- The conduct's own date, when the source gives one. Separate from `year`, and
-- never the date of the article, the listing or the seizure.
ALTER TABLE ledger_entries ADD COLUMN act_date TEXT;
-- day | month | year | unknown
ALTER TABLE ledger_entries ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'year';
-- The language the supporting passage was written in.
ALTER TABLE ledger_entries ADD COLUMN source_lang TEXT NOT NULL DEFAULT '';
-- The verbatim passage that supports the act, for the public evidence page.
ALTER TABLE ledger_entries ADD COLUMN evidence_quote TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ledger_review_status ON ledger_entries (review_status);
CREATE INDEX IF NOT EXISTS ledger_person ON ledger_entries (lower(person));

-- Every review decision is kept. A retraction that cannot be read back is not
-- a correction, it is a deletion with extra steps.
CREATE TABLE IF NOT EXISTS ledger_revisions (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  person TEXT NOT NULL,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  reviewer TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ledger_revisions_entry ON ledger_revisions (entry_id);
