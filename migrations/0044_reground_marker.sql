-- A document that has been searched for its legacy passages should not be
-- searched again on the next pass. Without a marker the stored pass keeps
-- returning the same forty documents because their unmatched claims stay
-- legacy, and the queue never advances.
ALTER TABLE documents ADD COLUMN reground_at TEXT NOT NULL DEFAULT '';
