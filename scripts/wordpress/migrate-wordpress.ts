/**
 * WordPress to Supabase Migration Script
 *
 * Imports WordPress posts and pages (exported as JSON from phpMyAdmin)
 * into the rlc_posts table in Supabase.
 *
 * Usage:
 *   pnpm tsx scripts/wordpress/migrate-wordpress.ts              # Full migration
 *   pnpm tsx scripts/wordpress/migrate-wordpress.ts --dry-run    # Validate only
 *   pnpm tsx scripts/wordpress/migrate-wordpress.ts --posts      # Posts only
 *   pnpm tsx scripts/wordpress/migrate-wordpress.ts --pages      # Pages only
 *
 * Prerequisites:
 *   1. Run the SQL queries in export-queries.sql via phpMyAdmin
 *   2. Save each result as JSON to scripts/wordpress/data/:
 *      - posts.json        (query 1)
 *      - pages.json        (query 2)
 *      - categories.json   (query 3)
 *      - tags.json         (query 4)
 *      - post_categories.json (query 5)
 *      - post_tags.json    (query 6)
 *      - featured_images.json (query 7)
 *
 *   3. Set env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DATA_DIR = path.join(__dirname, 'data');

// ===========================================
// Type definitions for WordPress exports
// ===========================================

interface WPPost {
  wp_id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  published_at: string;
  updated_at: string;
  status: string;
  post_type: string;
  author_name?: string;
  author_email?: string;
  // Pages have these
  post_parent?: number;
  menu_order?: number;
}

interface WPPostCategory {
  wp_post_id: number;
  category_name: string;
  category_slug: string;
}

interface WPPostTag {
  wp_post_id: number;
  tag_name: string;
  tag_slug: string;
}

interface WPFeaturedImage {
  wp_post_id: number;
  image_url: string;
  image_alt: string;
}

interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// ===========================================
// Helpers
// ===========================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadJSON<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  File not found: ${filename} — skipping`);
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  // phpMyAdmin exports as array or as { data: [...] } depending on version
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data)) return data.data;
  // Some phpMyAdmin versions wrap in numbered keys
  if (typeof data === 'object') return Object.values(data);
  return [];
}

/**
 * Strip WordPress shortcodes like [gallery], [caption], etc.
 * Convert basic WordPress blocks to HTML.
 */
function cleanWordPressContent(content: string | null): string | null {
  if (!content) return null;

  let cleaned = content;

  // Remove WordPress block comments <!-- wp:xxx -->
  cleaned = cleaned.replace(/<!-- \/?wp:\S+.*?-->/g, '');

  // Remove common shortcodes (preserve content inside them)
  cleaned = cleaned.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/g, '$1');
  cleaned = cleaned.replace(/\[gallery[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\[embed\]([\s\S]*?)\[\/embed\]/g, '$1');
  cleaned = cleaned.replace(/\[video[^\]]*\]([\s\S]*?)\[\/video\]/g, '$1');
  cleaned = cleaned.replace(/\[audio[^\]]*\]([\s\S]*?)\[\/audio\]/g, '$1');

  // Remove any remaining shortcodes
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim() || null;
}

/**
 * Map WordPress status to our post status values
 */
function mapStatus(wpStatus: string): string {
  switch (wpStatus) {
    case 'publish':
      return 'published';
    case 'draft':
      return 'draft';
    case 'pending':
      return 'draft';
    case 'private':
      return 'draft';
    case 'future':
      return 'draft';
    default:
      return 'draft';
  }
}

// ===========================================
// Build lookup maps
// ===========================================

function buildCategoryMap(postCategories: WPPostCategory[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const pc of postCategories) {
    const existing = map.get(pc.wp_post_id) || [];
    existing.push(pc.category_name);
    map.set(pc.wp_post_id, existing);
  }
  return map;
}

function buildTagMap(postTags: WPPostTag[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const pt of postTags) {
    const existing = map.get(pt.wp_post_id) || [];
    existing.push(pt.tag_name);
    map.set(pt.wp_post_id, existing);
  }
  return map;
}

function buildImageMap(images: WPFeaturedImage[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const img of images) {
    map.set(img.wp_post_id, img.image_url);
  }
  return map;
}

// ===========================================
// Migration
// ===========================================

async function migrateContent(
  items: WPPost[],
  categoryMap: Map<number, string[]>,
  tagMap: Map<number, string[]>,
  imageMap: Map<number, string>,
  dryRun: boolean
): Promise<MigrationResult> {
  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  console.log(`\n  Processing ${items.length} items...`);

  // Check for existing slugs to avoid duplicates
  const slugs = items.map((p) => slugify(p.slug || p.title));
  const { data: existingSlugs } = await supabase
    .from('rlc_posts')
    .select('slug')
    .in('slug', slugs);

  const existingSlugSet = new Set((existingSlugs || []).map((r: { slug: string }) => r.slug));

  // Batch insert in groups of 50
  const BATCH_SIZE = 50;
  const toInsert: Record<string, unknown>[] = [];

  for (const item of items) {
    const slug = slugify(item.slug || item.title);

    if (existingSlugSet.has(slug)) {
      result.skipped++;
      continue;
    }

    // Deduplicate within this batch too
    if (toInsert.some((r) => r.slug === slug)) {
      result.skipped++;
      continue;
    }

    const categories = categoryMap.get(item.wp_id) || [];
    const tags = tagMap.get(item.wp_id) || [];
    const featuredImage = imageMap.get(item.wp_id) || null;

    const content = cleanWordPressContent(item.content);
    const excerpt = item.excerpt?.trim() || null;
    const status = mapStatus(item.status);
    const publishedAt = item.status === 'publish' && item.published_at
      ? new Date(item.published_at).toISOString()
      : null;

    // For pages, add page-specific metadata
    const isPage = item.post_type === 'page';
    const metadata: Record<string, unknown> = {
      wp_id: item.wp_id,
      wp_post_type: item.post_type,
      wp_author: item.author_name || null,
      migrated_at: new Date().toISOString(),
    };
    if (isPage) {
      metadata.wp_parent_id = item.post_parent || null;
      metadata.wp_menu_order = item.menu_order || 0;
    }

    toInsert.push({
      id: crypto.randomUUID(),
      title: item.title,
      slug,
      content,
      excerpt,
      featured_image_url: featuredImage,
      author_id: null, // No member mapping for WordPress authors
      chapter_id: null,
      status,
      published_at: publishedAt,
      categories: isPage ? ['Pages'] : categories,
      tags,
      seo_title: item.title,
      seo_description: excerpt?.slice(0, 160) || null,
      metadata,
    });
  }

  if (dryRun) {
    console.log(`\n  [DRY RUN] Would insert ${toInsert.length} posts`);
    console.log(`  [DRY RUN] Skipped ${result.skipped} (already exist)`);
    result.success = toInsert.length;
    return result;
  }

  // Insert in batches
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('rlc_posts')
      .insert(batch as never[]);

    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      result.failed += batch.length;
      result.errors.push(`Batch insert error: ${error.message}`);
    } else {
      result.success += batch.length;
      process.stdout.write(`  Inserted ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length}\r`);
    }
  }

  console.log(); // newline after progress
  return result;
}

// ===========================================
// Main
// ===========================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const postsOnly = args.includes('--posts');
  const pagesOnly = args.includes('--pages');
  const migrateAll = !postsOnly && !pagesOnly;

  console.log('==========================================');
  console.log('WordPress → Supabase Migration');
  console.log('==========================================');
  if (dryRun) console.log('MODE: Dry run (no writes)');
  console.log(`DATA DIR: ${DATA_DIR}\n`);

  // Verify data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    console.error('Run the SQL queries from export-queries.sql in phpMyAdmin');
    console.error('and save the JSON results to scripts/wordpress/data/');
    process.exit(1);
  }

  // Load relationship data (needed for both posts and pages)
  console.log('Loading relationship data...');
  const postCategories = loadJSON<WPPostCategory>('post_categories.json');
  const postTags = loadJSON<WPPostTag>('post_tags.json');
  const featuredImages = loadJSON<WPFeaturedImage>('featured_images.json');

  const categoryMap = buildCategoryMap(postCategories);
  const tagMap = buildTagMap(postTags);
  const imageMap = buildImageMap(featuredImages);

  console.log(`  Categories: ${postCategories.length} relationships`);
  console.log(`  Tags: ${postTags.length} relationships`);
  console.log(`  Featured images: ${featuredImages.length} mappings`);

  let totalResult: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  // Migrate posts
  if (migrateAll || postsOnly) {
    console.log('\n--- Migrating Posts ---');
    const posts = loadJSON<WPPost>('posts.json');
    if (posts.length > 0) {
      console.log(`  Found ${posts.length} posts`);
      const postResult = await migrateContent(posts, categoryMap, tagMap, imageMap, dryRun);
      totalResult.success += postResult.success;
      totalResult.failed += postResult.failed;
      totalResult.skipped += postResult.skipped;
      totalResult.errors.push(...postResult.errors);
    } else {
      console.log('  No posts found — ensure posts.json exists in data/');
    }
  }

  // Migrate pages
  if (migrateAll || pagesOnly) {
    console.log('\n--- Migrating Pages ---');
    const pages = loadJSON<WPPost>('pages.json');
    if (pages.length > 0) {
      console.log(`  Found ${pages.length} pages`);
      const pageResult = await migrateContent(pages, categoryMap, tagMap, imageMap, dryRun);
      totalResult.success += pageResult.success;
      totalResult.failed += pageResult.failed;
      totalResult.skipped += pageResult.skipped;
      totalResult.errors.push(...pageResult.errors);
    } else {
      console.log('  No pages found — ensure pages.json exists in data/');
    }
  }

  // Summary
  console.log('\n==========================================');
  console.log('Migration Summary');
  console.log('==========================================');
  console.log(`  Inserted: ${totalResult.success}`);
  console.log(`  Skipped:  ${totalResult.skipped} (already exist)`);
  console.log(`  Failed:   ${totalResult.failed}`);

  if (totalResult.errors.length > 0) {
    console.log('\nErrors:');
    totalResult.errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('\nDone.');
  process.exit(totalResult.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
