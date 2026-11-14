-- Ada's take, next to the claim.
--
-- A claim on its own states what happened. The take says what follows from it,
-- or what would have to be true for it to matter — in the conditional where the
-- record does not establish the link. Stored with the claim so the person page
-- and the feed cannot drift apart, and copied onto the feed card so the feed
-- does not need a join per item.

ALTER TABLE ledger_entries ADD COLUMN take TEXT;
ALTER TABLE feed_items ADD COLUMN take TEXT NOT NULL DEFAULT '';
