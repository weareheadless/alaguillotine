-- The declared population, and the things it needs to be a population.
--
-- A coverage claim is only honest if the denominator was written down before
-- the counting. The House is 435 seats; the Clerk publishes who holds them,
-- with a bioguide id, a party, a state and a district. That file is the
-- declaration. Everything else — how many of those 435 the register can say
-- something about — is a query against it.
--
-- Two attributes join the entity, because the architecture already says party,
-- chamber and district are attributes of a person and there was nowhere to put
-- two of them. They come from the roster, with the roster as provenance.
ALTER TABLE entities ADD COLUMN state TEXT NOT NULL DEFAULT '';
ALTER TABLE entities ADD COLUMN district TEXT NOT NULL DEFAULT '';

-- When a name from a document cannot be resolved without guessing, it goes
-- here instead of into an entity. A queue of questions is cheaper than a
-- wrong merge, and a wrong merge is indistinguishable from a lie later.
CREATE TABLE IF NOT EXISTS entity_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  candidates TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS entity_review_open ON entity_review (resolved_at, created_at DESC);
