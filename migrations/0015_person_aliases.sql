-- One person, one record.
--
-- The ledger files people under whatever spelling the source used, and the
-- scorer looks up one key at a time. So "Sultan Al Jaber" and "Sultan Ahmed Al
-- Jaber" were two records: the second held a 2026 act, and the person stood at
-- zero. This is the explicit mapping, not a guess by substring: an alias is
-- added when someone has established that two spellings are one person.
CREATE TABLE IF NOT EXISTS person_aliases (
  alias TEXT PRIMARY KEY,
  canonical TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);

INSERT INTO person_aliases (alias, canonical, note, at)
VALUES ('sultan ahmed al jaber', 'Sultan Al Jaber',
        'Full name of the ADNOC chief executive; the ledger filed two acts under it.', datetime('now'))
ON CONFLICT(alias) DO NOTHING;
