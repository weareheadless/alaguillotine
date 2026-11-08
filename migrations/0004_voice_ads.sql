-- The popup pool: a week of Ada's interruptions, not just the latest set.
CREATE TABLE IF NOT EXISTS voice_ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS voice_ads_created ON voice_ads (created_at DESC);
