-- What a member oversees.
--
-- The roster already lists committee and subcommittee assignments; they were
-- parsed and thrown away, which is why the register could show a member's trades
-- and their votes but not the only relationship that makes either interesting:
-- whether the trade is in something their committee has jurisdiction over.
--
-- Assignments are a fact from the Clerk's roster, dated by the roster. The
-- jurisdiction mapping is editorial and lives in code, published with each lead,
-- because "Armed Services oversees defence procurement" is an argument, not a
-- data point, and the reader is entitled to see the rule they are being shown.
CREATE TABLE IF NOT EXISTS committees (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'standing',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS committee_assignments (
  entity_id TEXT NOT NULL,
  committee_code TEXT NOT NULL,
  committee_name TEXT NOT NULL DEFAULT '',
  subcommittee_code TEXT NOT NULL DEFAULT '',
  subcommittee_name TEXT NOT NULL DEFAULT '',
  rank TEXT NOT NULL DEFAULT '',
  leadership TEXT NOT NULL DEFAULT '',
  congress INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_id, committee_code, subcommittee_code)
);
CREATE INDEX IF NOT EXISTS committee_assignments_committee ON committee_assignments (committee_code);
