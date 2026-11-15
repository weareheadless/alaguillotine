-- Carry the old record into the register, unchanged, and let it prove itself.
--
-- Six thousand claims already exist, each with a sentence, a person, a category
-- and a list of URLs. Throwing that away would mean re-researching people we
-- already have. Importing it as if it were verified would make every number on
-- the site a lie. So it comes in as `legacy`: the sentence is kept, the document
-- rows are created, the links are made, and the quote is whatever the old row
-- had — almost always nothing. The re-grounding pass then fetches each document
-- once and tries to find the passage; whatever cannot be found stays legacy and
-- visibly uncited.
--
-- Idempotent: every insert is OR IGNORE against a natural key, so this can run
-- again after a partial failure.
INSERT OR IGNORE INTO documents
  (id, kind, issuer, title, number, url, published_at, retrieved_at,
   content_hash, provenance, fetched_at, http_status)
SELECT 'doc:' || u,
       CASE WHEN u LIKE '%courtlistener%' OR u LIKE '%court.gov%'
              OR u LIKE '%sec.gov%' OR u LIKE '%fec.gov%'
              OR u LIKE '%usaspending%' OR u LIKE '%congress.gov%'
              OR u LIKE '%companieshouse%' OR u LIKE '%treasury.gov%'
              OR u LIKE '%un.org%' OR u LIKE '%icc-cpi.int%' OR u LIKE '%ohchr.org%'
            THEN 'register' ELSE 'press' END,
       '', '', '', u, '', datetime('now'), '', 'legacy import', '', 0
  FROM (SELECT DISTINCT value AS u
          FROM ledger_entries, json_each(ledger_entries.sources)
         WHERE json_valid(ledger_entries.sources)
           AND value LIKE 'http%');

INSERT OR IGNORE INTO claims
  (id, entity_id, act, category, mechanism, beneficiary, act_date,
   date_precision, confidence, confidence_basis, status, claim_key,
   legacy_id, created_at, updated_at)
SELECT 'claim:' || le.id,
       ce.entity_id,
       le.act,
       le.category,
       le.mechanism,
       le.beneficiary,
       le.act_date,
       le.date_precision,
       0,
       'legacy: filed before the register, no quote',
       'legacy',
       lower(ce.entity_id) || '|' ||
         lower(trim(replace(replace(replace(le.act, '  ', ' '), '  ', ' '), '  ', ' '))) || '|' ||
         coalesce(le.act_date, ''),
       le.id,
       le.created_at,
       le.created_at
  FROM ledger_entries le
  JOIN claim_entities ce ON ce.claim_id = le.id AND ce.role = 'actor';

INSERT OR IGNORE INTO claim_documents (claim_id, document_id, quote, locator, stance)
SELECT 'claim:' || le.id, 'doc:' || j.value, coalesce(le.evidence_quote, ''), '',
       CASE WHEN j.value LIKE '%courtlistener%' OR j.value LIKE '%sec.gov%'
              OR j.value LIKE '%fec.gov%' OR j.value LIKE '%usaspending%'
              OR j.value LIKE '%congress.gov%' OR j.value LIKE '%treasury.gov%'
            THEN 'records' ELSE 'reports' END
  FROM ledger_entries le, json_each(le.sources) j
 WHERE json_valid(le.sources) AND j.value LIKE 'http%';
