-- Why a name was sentenced, and who says it is wrong.
--
-- The blade used to record only that it fell: person, score, time. The reason
-- lived in a queue row that the next pass could overwrite, so the explanation
-- for an execution was the one thing the record did not keep. These columns
-- snapshot it at the moment of the sentence and carry it into the event.
ALTER TABLE chop_sentences ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE chop_sentences ADD COLUMN basis TEXT NOT NULL DEFAULT '{}';
ALTER TABLE chop_events ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE chop_events ADD COLUMN basis TEXT NOT NULL DEFAULT '{}';

-- A challenge is a reader saying a row is wrong: wrong person, wrong fact,
-- fabricated, or missing context. It is filed against the claim, kept whether
-- it is upheld or rejected, and an upheld challenge retracts the claim.
CREATE TABLE IF NOT EXISTS claim_challenges (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  person TEXT NOT NULL DEFAULT '',
  sentence TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  detail TEXT NOT NULL,
  evidence_url TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS claim_challenges_open
  ON claim_challenges (status, created_at DESC);
CREATE INDEX IF NOT EXISTS claim_challenges_claim
  ON claim_challenges (claim_id);
