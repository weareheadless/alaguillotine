-- Public provenance, never the private draft/editorial conversation.
ALTER TABLE dispatches ADD COLUMN editorial TEXT NOT NULL DEFAULT '{}';
