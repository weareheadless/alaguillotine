-- Committees have parents, and a seat can be on a sub-committee.
--
-- The UK Commons publishes sub-committees as committees of their own, with a
-- parent id, and a member can sit on the Treasury Sub-Committee on Financial
-- Services Regulations without a separate seat on the Treasury Committee. The
-- sub-committee still has the parent's jurisdiction, so the rule lookup needs
-- the parent link; without it a sub-committee seat would silently produce no
-- leads even though the business before it is the same business.
--
-- The US House roster encodes this differently (a subcommittee code inside the
-- parent's block), so the column is empty there and the rule lookup falls back
-- to the committee's own code.
ALTER TABLE committees ADD COLUMN parent_code TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS committees_parent ON committees (parent_code);
