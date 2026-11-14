-- When Ada last wrote the take.
--
-- A take is rewritten when the voice changes, and a rewrite has to be visible
-- afterwards: which claims were re-read under the current voice, and which
-- still carry a line from an older one. Without this column the only way to
-- tell is to read all of them.
ALTER TABLE ledger_entries ADD COLUMN take_at TEXT;
