-- Evidence grade, not a court's permission slip.
--
-- The record kept asking one question — "is this proven?" — and answering it
-- with "did a court say so". That quietly excluded the conduct that never
-- reaches a charge, which is the conduct a site about impunity exists to name.
-- A Senate finance letter, a sworn transcript and two independent investigations
-- are evidence. So is a conviction. They are graded, not gated.
--
--   A  documents, an admission, or a finding
--   B  multiple independent investigations
--   C  one credible investigation
--   D  a single unverified allegation — visible in the archive, never scored
--
-- `institutional_status` is what the system did about it: charged, convicted,
-- investigated, settled, no_action, blocked, unknown. It is shown, never used
-- as a gate. "No action" is a fact about the system, not an acquittal.

ALTER TABLE ledger_entries ADD COLUMN evidence_grade TEXT NOT NULL DEFAULT '';
ALTER TABLE ledger_entries ADD COLUMN institutional_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE ledger_entries ADD COLUMN mechanism TEXT NOT NULL DEFAULT '';
ALTER TABLE ledger_entries ADD COLUMN beneficiary TEXT NOT NULL DEFAULT '';
-- Why this grade. Required for anything an editor sets to A or B.
ALTER TABLE ledger_entries ADD COLUMN grade_basis TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS ledger_grade ON ledger_entries (evidence_grade);

-- First pass, marked auto so review knows it is a default and not a judgement.
UPDATE ledger_entries SET evidence_grade = 'A', grade_basis = 'auto: primary roll call'
 WHERE evidence_grade = '' AND case_id LIKE 'congress:%';
UPDATE ledger_entries SET evidence_grade = 'B', institutional_status = 'sanctioned',
       grade_basis = 'auto: institutional listing, no adjudication'
 WHERE evidence_grade = '' AND case_id LIKE 'un:%';
UPDATE ledger_entries SET evidence_grade = 'B', grade_basis = 'auto: high-confidence filing'
 WHERE evidence_grade = '' AND confidence >= 85;
UPDATE ledger_entries SET evidence_grade = 'C', grade_basis = 'auto: credible-reporting tier'
 WHERE evidence_grade = '' AND confidence >= 65;
UPDATE ledger_entries SET evidence_grade = 'D', grade_basis = 'auto: thin source'
 WHERE evidence_grade = '';
