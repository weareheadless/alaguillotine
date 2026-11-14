-- Triage of what the numbers table was already publishing.

-- Whose money it is. A company's profit is not the chief executive's wealth,
-- and the page should say so in the row rather than in a footnote.
UPDATE person_numbers SET whose = 'person' WHERE kind = 'wealth' AND whose = '';
UPDATE person_numbers SET whose = 'firm'   WHERE kind IN ('profit', 'emissions') AND whose = '';
UPDATE person_numbers SET whose = 'fund'   WHERE label LIKE '%PIF assets%';

-- Tolls: say how they are known, because "recorded" and "projected" are not the
-- same claim and both were displayed the same way.
UPDATE person_numbers SET qualifier = 'attributed'
 WHERE kind IN ('deaths', 'displacement', 'workers') AND qualifier = '';

UPDATE person_numbers SET qualifier = 'estimate'
 WHERE slug = 'vladimir-putin' AND kind = 'deaths';
UPDATE person_numbers SET qualifier = 'estimate'
 WHERE slug = 'rodrigo-duterte' AND kind = 'deaths';
UPDATE person_numbers SET qualifier = 'estimate'
 WHERE slug = 'paul-kagame' AND kind = 'deaths';
UPDATE person_numbers SET qualifier = 'estimate'
 WHERE slug = 'abiy-ahmed' AND kind = 'deaths';
UPDATE person_numbers SET qualifier = 'recorded'
 WHERE slug = 'tony-blair' AND kind = 'deaths';

-- Projections. These are forecasts about a policy's future effect, not counts
-- of what happened, and one of them was filed as the subject's own death toll.
UPDATE person_numbers
   SET qualifier = 'projected', review_status = 'pending',
       grade_basis = 'A study''s forecast of future deaths, not a count of deaths; attributed to a policy, not to this person alone'
 WHERE slug = 'elon-musk' AND label LIKE 'projected deaths%';

UPDATE person_numbers
   SET qualifier = 'projected', review_status = 'pending',
       grade_basis = 'A Lancet projection of future child deaths from funding cuts, not a recorded toll'
 WHERE slug = 'marco-rubio' AND label LIKE 'projected child deaths%';

-- Country-level attributions with no act behind them. Held until someone can
-- name the decision that produced them.
UPDATE person_numbers
   SET review_status = 'pending',
       grade_basis = 'Country-wide air-pollution mortality, attributed to a head of government without a named decision; needs a claim, not a figure'
 WHERE slug = 'narendra-modi' AND kind = 'deaths';

-- Contested tolls that are already ranges in the source. Visible as estimates,
-- and the label has to carry that.
UPDATE person_numbers SET review_status = 'pending',
       grade_basis = 'Contested range; the source gives a spread, not a count'
 WHERE slug = 'paul-kagame' AND kind = 'deaths';

-- Everything that survives gets the same default grade as the claims: one
-- credible source, which is what this table is built from.
UPDATE person_numbers SET evidence_grade = 'C' WHERE evidence_grade = '';
