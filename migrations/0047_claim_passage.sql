-- The archive reads one passage per claim, not a join over every attachment.
--
-- claim_documents holds every source a claim was checked against. The archive
-- needs one: the first press passage. Computing that with a window function on
-- every request made the page time out, so the chosen source and sentence are
-- denormalised onto the claim and kept in step by the ingest.
ALTER TABLE claims ADD COLUMN document_id TEXT NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN quote TEXT NOT NULL DEFAULT '';

-- The press sources already on the record.
UPDATE claims
   SET document_id = (
         SELECT cd.document_id
           FROM claim_documents cd
           JOIN documents d ON d.id = cd.document_id
          WHERE cd.claim_id = claims.id AND d.kind = 'press'
          ORDER BY CASE WHEN cd.quote != '' THEN 0 ELSE 1 END, cd.document_id
          LIMIT 1
       )
 WHERE EXISTS (
         SELECT 1
           FROM claim_documents cd
           JOIN documents d ON d.id = cd.document_id
          WHERE cd.claim_id = claims.id AND d.kind = 'press'
       );

UPDATE claims
   SET quote = COALESCE((
         SELECT cd.quote
           FROM claim_documents cd
          WHERE cd.claim_id = claims.id AND cd.document_id = claims.document_id
          LIMIT 1
       ), '')
 WHERE document_id != '';

CREATE INDEX IF NOT EXISTS claims_document ON claims (document_id);
CREATE INDEX IF NOT EXISTS claims_quote ON claims (quote);
