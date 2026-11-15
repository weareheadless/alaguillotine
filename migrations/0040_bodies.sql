-- One register, many bodies.
--
-- The first declaration was the House, and for a while the code quietly assumed
-- that "the universe" meant "the House": the coverage page read `universes[0]`,
-- the committee rules had no body, and a number computed for 435 seats was
-- presented as if it described the register. It did not. A member of the
-- European Parliament is not a member of the House, and a coverage ratio that
-- mixes them is not a ratio of anything.
--
-- So a universe now says which country and which body it enumerates, and gets a
-- stable body key for rules and joins. Country is empty when the body spans
-- countries, as the European Parliament does; that is a fact about the body, not
-- a missing value. `body_key` is the stable name rules are scoped by, because
-- "Armed Services oversees defence procurement" is a rule about the US House and
-- must never be applied to another parliament by accident.
ALTER TABLE universes ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE universes ADD COLUMN body TEXT NOT NULL DEFAULT '';
ALTER TABLE universes ADD COLUMN body_key TEXT NOT NULL DEFAULT '';

UPDATE universes
   SET country = 'US',
       body = 'House of Representatives',
       body_key = 'US-House'
 WHERE id = 'house-119';

-- Committees belong to a body too. The Clerk's committee codes are not the
-- European Parliament's committee codes, and a seat only means something inside
-- the body that created it.
ALTER TABLE committees ADD COLUMN body_key TEXT NOT NULL DEFAULT '';
UPDATE committees SET body_key = 'US-House';

ALTER TABLE committee_assignments ADD COLUMN body_key TEXT NOT NULL DEFAULT '';
UPDATE committee_assignments SET body_key = 'US-House';

CREATE INDEX IF NOT EXISTS committees_body ON committees (body_key);
CREATE INDEX IF NOT EXISTS committee_assignments_body ON committee_assignments (body_key, entity_id);
