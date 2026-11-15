-- The dashboard asks "which body is this claim from" once per claim. Without
-- an index on the entity side, that correlated lookup scans every membership
-- row for every claim, which is fine at 1,900 people and not fine at scale.
CREATE INDEX IF NOT EXISTS universe_members_entity ON universe_members (entity_id);
