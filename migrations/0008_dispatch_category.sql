-- The dispatch's colour. Ada files each piece under the mechanism it names,
-- so the blog can be read as a board of charges rather than a list of dates.
ALTER TABLE dispatches ADD COLUMN category TEXT NOT NULL DEFAULT 'extraction';
