-- What they were, at the time the money moved.
--
-- A flow is only a conflict when the record also says what office the person
-- held while it moved. The same $2bn is a private investment in 2021 and a
-- conflict in 2026, and the difference is not the money — it is the position.
--
--   capacity   the role held at that date, in the source's own terms
--              ("Senior Adviser to the President", "founder of Affinity")
--   in_office  1 when that role was a public office or an official assignment
--
-- The flag is set by a reviewer, not inferred from the words. The page counts
-- the flows made while holding one, and states the count; it does not argue
-- about what the count means.

ALTER TABLE person_numbers ADD COLUMN capacity TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN in_office INTEGER NOT NULL DEFAULT 0;
