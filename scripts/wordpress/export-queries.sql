-- ===========================================
-- WordPress Data Export Queries
-- ===========================================
-- Run these queries against the WordPress database via phpMyAdmin
-- (cPanel → phpMyAdmin → database: repl00_newrlc or similar)
--
-- Save each result as JSON to scripts/wordpress/data/
-- In phpMyAdmin: Run query → Export → JSON
-- ===========================================

-- -----------------------------------------
-- 1. Export Published Posts
-- -----------------------------------------
SELECT
  p.ID as wp_id,
  p.post_title as title,
  p.post_name as slug,
  p.post_content as content,
  p.post_excerpt as excerpt,
  p.post_date as published_at,
  p.post_modified as updated_at,
  p.post_status as status,
  p.post_type,
  u.display_name as author_name,
  u.user_email as author_email
FROM wp_posts p
LEFT JOIN wp_users u ON p.post_author = u.ID
WHERE p.post_type = 'post'
  AND p.post_status IN ('publish', 'draft')
ORDER BY p.post_date DESC;

-- -----------------------------------------
-- 2. Export Published Pages
-- -----------------------------------------
SELECT
  p.ID as wp_id,
  p.post_title as title,
  p.post_name as slug,
  p.post_content as content,
  p.post_excerpt as excerpt,
  p.post_date as published_at,
  p.post_modified as updated_at,
  p.post_status as status,
  p.post_type,
  p.post_parent,
  p.menu_order
FROM wp_posts p
WHERE p.post_type = 'page'
  AND p.post_status IN ('publish', 'draft')
ORDER BY p.menu_order, p.post_title;

-- -----------------------------------------
-- 3. Export Categories (for post categorization)
-- -----------------------------------------
SELECT
  t.term_id,
  t.name as category_name,
  t.slug as category_slug,
  tt.description,
  tt.count as post_count
FROM wp_terms t
JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'category'
ORDER BY t.name;

-- -----------------------------------------
-- 4. Export Tags
-- -----------------------------------------
SELECT
  t.term_id,
  t.name as tag_name,
  t.slug as tag_slug,
  tt.count as post_count
FROM wp_terms t
JOIN wp_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'post_tag'
ORDER BY t.name;

-- -----------------------------------------
-- 5. Export Post-Category Relationships
-- -----------------------------------------
SELECT
  tr.object_id as wp_post_id,
  t.name as category_name,
  t.slug as category_slug
FROM wp_term_relationships tr
JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
JOIN wp_terms t ON tt.term_id = t.term_id
WHERE tt.taxonomy = 'category'
ORDER BY tr.object_id;

-- -----------------------------------------
-- 6. Export Post-Tag Relationships
-- -----------------------------------------
SELECT
  tr.object_id as wp_post_id,
  t.name as tag_name,
  t.slug as tag_slug
FROM wp_term_relationships tr
JOIN wp_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
JOIN wp_terms t ON tt.term_id = t.term_id
WHERE tt.taxonomy = 'post_tag'
ORDER BY tr.object_id;

-- -----------------------------------------
-- 7. Export Featured Images (post thumbnails)
-- -----------------------------------------
SELECT
  pm.post_id as wp_post_id,
  attachment.guid as image_url,
  attachment.post_title as image_alt
FROM wp_postmeta pm
JOIN wp_posts attachment ON pm.meta_value = attachment.ID
WHERE pm.meta_key = '_thumbnail_id'
  AND attachment.post_type = 'attachment'
ORDER BY pm.post_id;

-- -----------------------------------------
-- 8. Summary Statistics (for validation)
-- -----------------------------------------
SELECT 'published_posts' as entity, COUNT(*) as count
FROM wp_posts WHERE post_type = 'post' AND post_status = 'publish'
UNION ALL
SELECT 'draft_posts', COUNT(*)
FROM wp_posts WHERE post_type = 'post' AND post_status = 'draft'
UNION ALL
SELECT 'published_pages', COUNT(*)
FROM wp_posts WHERE post_type = 'page' AND post_status = 'publish'
UNION ALL
SELECT 'categories', COUNT(*)
FROM wp_term_taxonomy WHERE taxonomy = 'category'
UNION ALL
SELECT 'tags', COUNT(*)
FROM wp_term_taxonomy WHERE taxonomy = 'post_tag'
UNION ALL
SELECT 'featured_images', COUNT(*)
FROM wp_postmeta WHERE meta_key = '_thumbnail_id';

-- -----------------------------------------
-- NOTE ON TABLE PREFIX
-- -----------------------------------------
-- The default WordPress table prefix is wp_
-- If the RLC site uses a different prefix (e.g., rlc_wp_),
-- replace all 'wp_' with the actual prefix.
-- Check wp-config.php for $table_prefix value.
