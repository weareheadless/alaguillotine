-- Three numbers, because one flatters the register.
--
-- `covered` used to mean "has a passage from a document that is not a roll
-- call", which was fine when the only such document was journalism. Then trade
-- filings arrived and the same number went from 1 to 91 of 433 without a single
-- new finding: a member's portfolio is documentation, but it is not an
-- accusation.
--
-- So the coverage view now reports three cumulative counts:
--   read        a document was read that names them, with a passage stored
--   documented  the passage is about an act, not a vote
--   accused     the passage is about a misdeed, from a press or register document
--
-- They are cumulative on purpose: everyone accused is documented, everyone
-- documented has been read. Only the last one answers "how much of the House
-- has this site actually documented doing something wrong".
DROP VIEW IF EXISTS coverage;

CREATE VIEW coverage AS
SELECT u.id AS universe_id,
       u.name AS name,
       u.expected AS expected,
       u.declared_at AS declared_at,
       COUNT(m.entity_id) AS listed,
       SUM(CASE WHEN m.status IN ('read', 'documented', 'accused') THEN 1 ELSE 0 END) AS read,
       SUM(CASE WHEN m.status IN ('documented', 'accused') THEN 1 ELSE 0 END) AS documented,
       SUM(CASE WHEN m.status = 'accused' THEN 1 ELSE 0 END) AS accused
  FROM universes u
  LEFT JOIN universe_members m ON m.universe_id = u.id
 GROUP BY u.id;
