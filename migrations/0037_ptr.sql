-- Trades.
--
-- A Periodic Transaction Report is the only public record of what a member
-- traded, and it is a PDF. The row is the fact: owner, asset, type, date,
-- amount band. The band is a band because that is what the law asks them to
-- disclose, so the register stores the range and never a midpoint dressed up as
-- a number.
--
-- `status = 'recorded'` on these claims means the filing says so. It does not
-- mean the trade was wrong, self-dealing, or a conflict: a trade is a fact
-- about a portfolio, and the reader is the judge of what it means next to a
-- committee seat.
CREATE TABLE IF NOT EXISTS ptr_filings (
  document_id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 0,
  /** P is a periodic transaction report; A an amendment to one. */
  filing_type TEXT NOT NULL DEFAULT 'P',
  filing_date TEXT NOT NULL DEFAULT '',
  state_dst TEXT NOT NULL DEFAULT '',
  filer_name TEXT NOT NULL DEFAULT '',
  /** The member the filing belongs to, when the roster resolves them. */
  member_entity TEXT NOT NULL DEFAULT '',
  transactions INTEGER NOT NULL DEFAULT 0,
  parsed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ptr_filings_member ON ptr_filings (member_entity, filing_date DESC);
CREATE INDEX IF NOT EXISTS ptr_filings_year ON ptr_filings (year, filing_date DESC);

CREATE TABLE IF NOT EXISTS ptr_transactions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  asset TEXT NOT NULL DEFAULT '',
  ticker TEXT NOT NULL DEFAULT '',
  asset_type TEXT NOT NULL DEFAULT '',
  /** P purchase, S sale, E exchange, G gift. */
  txn_type TEXT NOT NULL DEFAULT '',
  txn_date TEXT NOT NULL DEFAULT '',
  notified TEXT NOT NULL DEFAULT '',
  amount_low REAL,
  amount_high REAL,
  amount_label TEXT NOT NULL DEFAULT '',
  line INTEGER NOT NULL DEFAULT 0,
  claim_id TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ptr_transactions_doc ON ptr_transactions (document_id, line);
CREATE INDEX IF NOT EXISTS ptr_transactions_member ON ptr_transactions (entity_id, txn_date DESC);
