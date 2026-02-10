-- Add content_type to distinguish posts from pages
ALTER TABLE "rlc_posts" ADD COLUMN IF NOT EXISTS "content_type" VARCHAR(20) NOT NULL DEFAULT 'post';

-- Migrate existing "Pages" category entries to content_type='page'
UPDATE "rlc_posts" SET content_type = 'page'
WHERE 'Pages' = ANY(categories);
