-- Ada's take, on the record the site actually publishes.
--
-- The take — why this act is on the record, not what happened — was written
-- against the old ledger, whose rows no longer appear anywhere. The same
-- analysis now belongs to the claim, which is the row a reader sees.
ALTER TABLE claims ADD COLUMN take TEXT;
ALTER TABLE claims ADD COLUMN take_at TEXT;

CREATE INDEX IF NOT EXISTS claims_take_pending ON claims (take);
