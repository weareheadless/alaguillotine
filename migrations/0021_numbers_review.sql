-- The numbers get the same gate as the claims.
--
-- The positions join exposed what the numbers table was publishing without a
-- reviewer: "14 million deaths" that a study projected, "2 million deaths"
-- that are air pollution in a country rather than an act, "$55B profit" that
-- is the company's and not the person's. Every one of them was live on a card.
--
-- So a number now needs the same three things a claim needs:
--
--   review_status  pending | accepted | rejected | legacy
--   evidence_grade A/B/C/D — a document, several investigations, one, or an allegation
--   qualifier      recorded   a count from a record (a court, a registry, an official toll)
--                  attributed a count a source attributes to the subject's acts
--                  projected  a study's forecast of what will happen
--                  estimate   a range or contested figure
--   whose          person | firm | fund | state — whose money or toll it is
--
-- `whose` exists because "ExxonMobil posted $55bn profit" is not "$55bn to the
-- CEO", and a graph that draws them the same way is lying with a straight face.

-- evidence_grade and grade_basis already exist from 0017.
ALTER TABLE person_numbers ADD COLUMN review_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE person_numbers ADD COLUMN qualifier TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN whose TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS person_numbers_review ON person_numbers (review_status);
