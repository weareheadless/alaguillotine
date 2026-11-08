-- Lemmy with no email:
--
-- The forum takes no email address. Lemmy stores a submitted empty email as
-- '' (not NULL), and on registration approval it sees Some("") and tries to
-- send a notification. With no SMTP configured that returns `no_email_setup`
-- *after* the approval has already committed, so the admin sees a 400 even
-- though the account is now approved.
--
-- This trigger normalises '' to NULL. Approval then skips the email branch
-- entirely, and the request succeeds.
--
-- Apply with:
--   docker compose exec -T postgres psql -U lemmy -d lemmy < no-email.sql

CREATE OR REPLACE FUNCTION normalize_empty_email() RETURNS trigger AS $$
BEGIN
  IF NEW.email = '' THEN
    NEW.email := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_empty_email ON local_user;
CREATE TRIGGER normalize_empty_email
BEFORE INSERT OR UPDATE ON local_user
FOR EACH ROW EXECUTE FUNCTION normalize_empty_email();

UPDATE local_user SET email = NULL WHERE email = '';
