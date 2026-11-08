-- Names proposed by the public. Ada screens each one; a human approves.
-- No account and no email: the receipt code is the only handle the submitter
-- gets, so it must be unguessable and shown once.

CREATE TABLE IF NOT EXISTS name_submissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  acts TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  why TEXT NOT NULL DEFAULT '',
  submitter TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  verdict TEXT NOT NULL DEFAULT '',
  reviewer TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON name_submissions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_ip ON name_submissions(ip_hash, created_at);