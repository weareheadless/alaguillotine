-- The feed: the site's doom scroll.
--
-- Every card is a row. Wire items come from the federated communities Ada
-- already reads; record items are her dispatches and the receipts behind the
-- names. `first_seen_at` is when the feed met the item, which is what the
-- ranking uses — the feed is ordered by what is new to it, not by what is new
-- to the world.
CREATE TABLE IF NOT EXISTS feed_items (
  id TEXT PRIMARY KEY,
  -- wire | charge | record | ad
  kind TEXT NOT NULL DEFAULT 'wire',
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  -- the line the card leads with: Ada's verdict, or the receipt's label
  gloss TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  community TEXT NOT NULL DEFAULT '',
  -- extraction | cost | impunity | suppression | precarity | wire
  category TEXT NOT NULL DEFAULT 'wire',
  score INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  severity INTEGER NOT NULL DEFAULT 0,
  -- the story this item belongs to; duplicates share a representative id
  cluster TEXT NOT NULL DEFAULT '',
  cluster_size INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feed_first_seen ON feed_items (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS feed_cluster ON feed_items (cluster);
