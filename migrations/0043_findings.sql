-- A finding is not a document class.
--
-- The register was treating any grounded claim on a press document as an
-- accusation. That is the same overclaim in a new place: a paper reporting that
-- a minister attended a meeting is not reporting a misdeed. The difference is
-- what the passage asserts, so it gets its own field rather than being inferred
-- from where the passage was published.
--
-- none     — an act, a vote, a trade, a declaration. Not wrongdoing.
-- alleged  — a passage accusing someone of a misdeed, with no official finding.
-- found    — a court, regulator, inquiry or warrant concluded it.
-- admitted — the actor conceded it.
--
-- `accused` requires a finding. Press is one place a finding can come from, not
-- the definition of one.
ALTER TABLE claims ADD COLUMN finding TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS claims_finding ON claims (finding);

-- Backfill only what the record already asserts. A document whose stance is
-- `finds` is a conclusion by someone empowered to conclude; `admits` is the
-- actor's own concession. Everything else stays `none`, including the press
-- archive: a report is not yet a finding.
UPDATE claims SET finding = 'found'
 WHERE finding = 'none'
   AND EXISTS (SELECT 1 FROM claim_documents cd WHERE cd.claim_id = claims.id AND cd.stance = 'finds');

UPDATE claims SET finding = 'admitted'
 WHERE finding = 'none'
   AND EXISTS (SELECT 1 FROM claim_documents cd WHERE cd.claim_id = claims.id AND cd.stance = 'admits');

UPDATE claims SET finding = 'alleged'
 WHERE finding = 'none'
   AND (status = 'alleged'
        OR EXISTS (SELECT 1 FROM claim_documents cd WHERE cd.claim_id = claims.id AND cd.stance = 'alleges'));
