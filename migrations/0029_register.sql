-- The register.
--
-- The archive stores claims keyed by a person's name, and the name is a string:
-- "Jared Kushner" and "JARED KUSHNER" are two rows, a company has no row at all,
-- and a claim cannot say which document it came from beyond a URL in a JSON
-- array. That is a pile of accusations with footnotes, not a register that can
-- be queried.
--
-- Four things are missing, and they are the four this adds: who (entities),
-- what document (documents), which claim came from which document
-- (claim_documents), and who a claim is about, who paid and who benefited
-- (claim_entities).
--
-- The split matters because it moves bias from opinion to arithmetic. A claim
-- is only as good as the document under it; a document is issued by an
-- institution with a number and a date; an entity's party, committee or
-- company is an attribute with provenance rather than a guess from prose. Once
-- those three are separate, "we cover the left more than the right" becomes a
-- join against a declared population instead of an argument.

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  -- person | company | committee | agency | party | fund | state
  kind TEXT NOT NULL DEFAULT 'person',
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  -- Alternate spellings the ledger already files under. One person filed two
  -- ways was scoring as two people; aliases are how that stops.
  aliases TEXT NOT NULL DEFAULT '[]',
  country TEXT NOT NULL DEFAULT '',
  -- Party, chamber, district, office: attributes. Never the unit of a claim.
  affiliation TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  -- bioguide, fec_committee, cik, lei, ofac_sdn, duns, wikidata. Documents
  -- join to people by number, not by name.
  external_ids TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS entities_slug ON entities (slug, kind);
CREATE INDEX IF NOT EXISTS entities_name ON entities (name);

CREATE TABLE IF NOT EXISTS documents (
  -- docket | fec | ptr | contract | sanction | roll_call | filing | registry | press
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  -- The court, the FEC, the House Clerk, the Treasury, DSCA, a company registry.
  issuer TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  -- Docket number, filing id, contract id, PTR id: what you would type to find
  -- it again without us.
  number TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT '',
  retrieved_at TEXT NOT NULL,
  content_hash TEXT NOT NULL DEFAULT '',
  -- Where inside the document the quote sits: a page range, a paragraph, a row.
  locator TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS documents_url ON documents (url);
CREATE INDEX IF NOT EXISTS documents_kind ON documents (kind, published_at DESC);

CREATE TABLE IF NOT EXISTS claim_documents (
  claim_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  quote TEXT NOT NULL DEFAULT '',
  locator TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (claim_id, document_id)
);
CREATE INDEX IF NOT EXISTS claim_documents_document ON claim_documents (document_id);

CREATE TABLE IF NOT EXISTS claim_entities (
  claim_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  -- actor | payer | beneficiary | counterparty | owner | official
  role TEXT NOT NULL DEFAULT 'actor',
  PRIMARY KEY (claim_id, entity_id, role)
);
CREATE INDEX IF NOT EXISTS claim_entities_entity ON claim_entities (entity_id, role);

-- Universes: the population a coverage claim is measured against, declared
-- before looking. "All 535 members of Congress" or "the hundred largest federal
-- contractors" is a query and a count, not a mood. The gap between the declared
-- population and the rows in the record is the only measure of bias the site
-- can honestly publish.
CREATE TABLE IF NOT EXISTS universes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- How the population is enumerated, in words a reader can check.
  definition TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  declared_at TEXT NOT NULL,
  -- How many rows the declaration expects. A universe of unknown size cannot
  -- be audited.
  expected INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS universe_members (
  universe_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  -- listed | covered | excluded
  status TEXT NOT NULL DEFAULT 'listed',
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (universe_id, entity_id)
);
CREATE INDEX IF NOT EXISTS universe_members_status ON universe_members (universe_id, status);

CREATE VIEW IF NOT EXISTS coverage AS
SELECT u.id AS universe_id,
       u.name AS name,
       u.expected AS expected,
       COUNT(m.entity_id) AS listed,
       SUM(CASE WHEN m.status = 'covered' THEN 1 ELSE 0 END) AS covered,
       u.declared_at AS declared_at
  FROM universes u
  LEFT JOIN universe_members m ON m.universe_id = u.id
 GROUP BY u.id;
