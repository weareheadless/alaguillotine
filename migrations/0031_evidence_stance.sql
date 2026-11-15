-- What kind of proof is this, and who made it.
--
-- "Official document" was too narrow: states that commit the acts also write
-- most of the paperwork, and the people who never get indicted are usually the
-- ones with the best lawyers. But "any source" is how a site becomes a rumour
-- mill. The way out is not fewer source types, it is saying which type each
-- artifact is and what it actually establishes.
--
-- stance records the relation between the artifact and the claim:
--   admits  — the actor's own statement or filing concedes the act
--   finds   — a court, warrant, inquiry or regulator concluded it
--   records — an official register of the act: contract, gazette, vote, listing
--   reports — named journalism, field investigation, witness testimony, OSINT
--   alleges — an accusation with no artifact behind it (a lead, never a claim)
--
-- An admission is often the strongest artifact available. A military
-- spokesperson announcing the strike has documented the act; what they deny is
-- the characterisation, and the characterisation is a separate row.
ALTER TABLE claim_documents ADD COLUMN stance TEXT NOT NULL DEFAULT 'reports';

-- Who produced the artifact and how, in their own terms: "ICC, arrest warrant",
-- "UN OHCHR, commission of inquiry", "Bellingcat, geolocation of strike video",
-- "company registry, PSC filing". Shown to the reader, never summarised away.
ALTER TABLE documents ADD COLUMN provenance TEXT NOT NULL DEFAULT '';

-- A document made by the actor is not disqualified for being self-serving, but
-- the reader should see that it is. 0 = third party, 1 = the actor or its organ.
ALTER TABLE documents ADD COLUMN self_serving INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS claim_documents_stance ON claim_documents (stance);
