-- Declaring an interest is not admitting a misdeed.
--
-- The first backfill promoted every `admits` stance to a finding of wrongdoing.
-- In this register `admits` is used for a member's own conflict declaration:
-- the actor conceding an interest, not a wrong. It made 40 declarations look
-- like findings. An admission only becomes a finding when the passage admits
-- the misdeed itself, which a filing does not.
UPDATE claims SET finding = 'none'
 WHERE finding = 'admitted'
   AND id IN (
     SELECT cd.claim_id
       FROM claim_documents cd
       JOIN documents d ON d.id = cd.document_id
      WHERE cd.stance = 'admits' AND d.kind = 'register'
   );
