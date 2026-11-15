-- Standing relationships between entities.
--
-- A claim is an act: someone did something on a date, and a document says so.
-- An edge is structure: who owns, who directs, who funds, who appoints. The
-- two are different and the archive needs both, because acts name the person
-- holding the pen and edges name the person paying for it.
--
-- Without edges the archive can only ever reach people a document mentions by
-- name in an act. A billionaire who never signs anything and never appears in a
-- story is unreachable — but their name is legally in the contribution
-- schedule, the foundation's officer list, the 5% ownership filing and the
-- register of persons with significant control. Those are the documents that
-- make a financier findable without accusing anyone by association: the edge
-- says "owns", the degree of separation is public, and any claim built on it
-- still needs its own document.
CREATE TABLE IF NOT EXISTS entity_edges (
  id TEXT PRIMARY KEY,
  from_entity TEXT NOT NULL,
  to_entity TEXT NOT NULL,
  -- owns | directs | funds | contracts | employs | appoints | controls | donated_to | lobbies_for
  kind TEXT NOT NULL,
  -- When the relationship is dated by the document; empty when it is standing.
  since TEXT NOT NULL DEFAULT '',
  amount REAL,
  currency TEXT NOT NULL DEFAULT '',
  -- The document that states the relationship: a PSC filing, a 13D, a 990
  -- officer list, a contribution schedule, a contract award.
  document_id TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS entity_edges_from ON entity_edges (from_entity, kind);
CREATE INDEX IF NOT EXISTS entity_edges_to ON entity_edges (to_entity, kind);

-- Two hops is the working limit: a contract to a company, the company to its
-- owner. Longer chains are how a site becomes a conspiracy diagram.
CREATE VIEW IF NOT EXISTS entity_neighbourhood AS
SELECT e.id AS entity_id,
       e.name AS name,
       e.kind AS kind,
       COUNT(DISTINCT ed.id) AS edges
  FROM entities e
  LEFT JOIN entity_edges ed
    ON ed.from_entity = e.id OR ed.to_entity = e.id
 GROUP BY e.id;
