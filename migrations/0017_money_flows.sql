-- The money, as a sequence and not a scoreboard.
--
-- The numbers pass was built to answer "what is this person worth and what did
-- it cost", one figure per kind. That produces a scoreboard: a net worth, a
-- fine, a donation. It cannot show a flow — the same money arriving, being
-- charged a fee, sitting in an asset, being sold — which is the thing that
-- actually describes how extraction works.
--
-- These columns turn each row from a figure into a movement: when, which way,
-- through what instrument, with whom, and whether anyone was told.
--
--   direction   in | out        money toward the subject | money away from them
--   instrument  fee | equity | lease | contract | donation | penalty | subsidy |
--               gift | loan | salary | settlement
--   counterparty  who paid or was paid, named as the source names them
--   act_date    the date of the movement, when the source gives one
--   declared    disclosed | exempt | no_filing | withheld | unknown
--
-- declared is the quiet one. A flow that was never disclosed is not a crime on
-- this record; it is a fact about the arrangement, and it belongs beside the
-- figure rather than in a footnote.

ALTER TABLE person_numbers ADD COLUMN act_date TEXT;
ALTER TABLE person_numbers ADD COLUMN direction TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN instrument TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN counterparty TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN evidence_grade TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN grade_basis TEXT NOT NULL DEFAULT '';
ALTER TABLE person_numbers ADD COLUMN declared TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS person_numbers_date ON person_numbers (slug, act_date);
