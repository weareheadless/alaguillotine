-- Only source-provided, non-NSFW thumbnails; never manufactured news imagery.
ALTER TABLE feed_items ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
