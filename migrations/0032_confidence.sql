-- Confidence needs a paper trail, and corroboration needs to know what is
-- actually independent.
--
-- A story that cites another story is one source, not two, and a hundred
-- aggregators quoting the same wire are still one. Today the archive cannot
-- tell the difference: every source is a URL in an array. This records where an
-- artifact came from, and the arithmetic behind a claim's confidence, so the
-- reader can see what the number is made of instead of being asked to trust it.
ALTER TABLE documents ADD COLUMN derived_from TEXT NOT NULL DEFAULT '';

-- The components: stance, independent origins, whether the passage names the
-- person, whether it dates the act, whether the account is the actor's own.
ALTER TABLE ledger_entries ADD COLUMN confidence_basis TEXT NOT NULL DEFAULT '';
