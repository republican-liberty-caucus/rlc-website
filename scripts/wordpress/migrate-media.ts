/**
 * WordPress Media Migration Script
 *
 * Downloads images from old WordPress servers and uploads them to Supabase Storage,
 * then rewrites URLs in the rlc_posts table (featured_image_url + inline content).
 *
 * Usage:
 *   pnpm tsx scripts/wordpress/migrate-media.ts              # Full migration
 *   pnpm tsx scripts/wordpress/migrate-media.ts --dry-run    # Show what would happen
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
 *   - Old WordPress server(s) still serving images
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET_NAME = 'wordpress-media';

// Domains we expect WordPress images to come from
const WP_DOMAINS = [
  'rlc.org',
  'www.rlc.org',
  'new.rlc.org',
  'brevardrepublicans.com',
  'www.brevardrepublicans.com',
  'rlccef.com',
  'www.rlccef.com',
  'vps.virtualinfosys.us',
];

// Regex to find image URLs in HTML content
const IMG_SRC_REGEX = /<img[^>]+src=["']([^"']+)["']/gi;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RlcPost {
  id: string;
  featured_image_url: string | null;
  content: string | null;
}

interface MigrationStats {
  downloaded: number;
  uploaded: number;
  skipped: number;
  failed: number;
  rewrittenFeatured: number;
  rewrittenContent: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWordPressImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return WP_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d)
    );
  } catch {
    return false;
  }
}

/**
 * Extract a storage path from a WordPress URL.
 * e.g. https://rlc.org/wp-content/uploads/2023/05/photo.jpg → 2023/05/photo.jpg
 * For URLs without /uploads/YYYY/MM/ pattern, use a flat path.
 */
function storagePathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);

    // Try to extract year/month/filename from wp-content/uploads path
    const uploadsMatch = pathname.match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)$/);
    if (uploadsMatch) {
      const [, year, month, filename] = uploadsMatch;
      return `${year}/${month}/${filename}`;
    }

    // Fallback: use the filename from the URL path
    const segments = pathname.split('/').filter(Boolean);
    const filename = segments[segments.length - 1] || 'unknown';
    return `misc/${filename}`;
  } catch {
    return `misc/${Date.now()}-unknown`;
  }
}

/**
 * Build the public URL for an object in Supabase Storage.
 */
function supabasePublicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
}

/**
 * Normalize a URL to HTTPS and trim whitespace.
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.slice(7);
  }
  return normalized;
}

/**
 * Extract all unique WordPress image URLs from HTML content.
 */
function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  // Reset the regex state
  const regex = new RegExp(IMG_SRC_REGEX.source, IMG_SRC_REGEX.flags);
  while ((match = regex.exec(html)) !== null) {
    const src = normalizeUrl(match[1]);
    if (isWordPressImageUrl(src)) {
      urls.push(src);
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Core migration logic
// ---------------------------------------------------------------------------

async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
    });
    if (error) {
      throw new Error(`Failed to create bucket "${BUCKET_NAME}": ${error.message}`);
    }
    console.log(`  Created storage bucket: ${BUCKET_NAME}`);
  } else {
    console.log(`  Bucket "${BUCKET_NAME}" already exists`);
  }
}

/**
 * Download an image from a URL, upload to Supabase Storage.
 * Returns the new public URL, or null on failure.
 */
async function migrateImage(
  originalUrl: string,
  urlToPathMap: Map<string, string>,
  stats: MigrationStats,
  dryRun: boolean
): Promise<string | null> {
  const storagePath = storagePathFromUrl(originalUrl);

  // Already processed in this run?
  if (urlToPathMap.has(originalUrl)) {
    return supabasePublicUrl(urlToPathMap.get(originalUrl)!);
  }

  // Check if already exists in storage
  const pathParts = storagePath.split('/');
  const folder = pathParts.slice(0, -1).join('/');
  const filename = pathParts[pathParts.length - 1];

  if (!dryRun) {
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, { search: filename });

    if (existingFiles && existingFiles.some((f) => f.name === filename)) {
      stats.skipped++;
      urlToPathMap.set(originalUrl, storagePath);
      return supabasePublicUrl(storagePath);
    }
  }

  if (dryRun) {
    urlToPathMap.set(originalUrl, storagePath);
    stats.downloaded++;
    stats.uploaded++;
    return supabasePublicUrl(storagePath);
  }

  // Download
  let imageBuffer: ArrayBuffer;
  let contentType: string;
  try {
    const response = await fetch(originalUrl, {
      headers: { 'User-Agent': 'RLC-Media-Migration/1.0' },
      redirect: 'follow',
    });

    if (!response.ok) {
      if (response.status === 404) {
        stats.failed++;
        stats.errors.push(`404 Not Found: ${originalUrl}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    contentType = response.headers.get('content-type') || 'image/jpeg';
    imageBuffer = await response.arrayBuffer();
    stats.downloaded++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.failed++;
    stats.errors.push(`Download failed (${originalUrl}): ${msg}`);
    return null;
  }

  // Upload
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, imageBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    // If it's a duplicate, that's fine — just use the existing file
    if (uploadError.message?.includes('already exists') || uploadError.message?.includes('Duplicate')) {
      stats.skipped++;
    } else {
      stats.failed++;
      stats.errors.push(`Upload failed (${storagePath}): ${uploadError.message}`);
      return null;
    }
  } else {
    stats.uploaded++;
  }

  urlToPathMap.set(originalUrl, storagePath);
  return supabasePublicUrl(storagePath);
}

/**
 * Rewrite all WordPress image URLs in an HTML string.
 */
function rewriteContentUrls(
  html: string,
  urlToNewUrl: Map<string, string>
): string {
  let result = html;
  for (const [oldUrl, newUrl] of urlToNewUrl) {
    // Replace all occurrences (src attributes, srcset, etc.)
    result = result.split(oldUrl).join(newUrl);
    // Also handle http variant if we normalized to https
    const httpVariant = oldUrl.replace('https://', 'http://');
    if (httpVariant !== oldUrl) {
      result = result.split(httpVariant).join(newUrl);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('==========================================');
  console.log('WordPress Media → Supabase Storage');
  console.log('==========================================');
  if (dryRun) console.log('MODE: Dry run (no writes)\n');

  // 1. Ensure bucket
  console.log('Step 1: Ensure storage bucket exists');
  if (!dryRun) {
    await ensureBucketExists();
  } else {
    console.log(`  [DRY RUN] Would create bucket "${BUCKET_NAME}" if missing`);
  }

  // 2. Fetch all posts with image data
  console.log('\nStep 2: Fetching posts from rlc_posts...');
  const { data: posts, error: fetchError } = await supabase
    .from('rlc_posts')
    .select('id, featured_image_url, content');

  if (fetchError) {
    console.error('Failed to fetch posts:', fetchError.message);
    process.exit(1);
  }

  console.log(`  Found ${posts.length} posts`);

  // 3. Collect all unique WordPress image URLs
  console.log('\nStep 3: Scanning for WordPress image URLs...');
  const allUrls = new Set<string>();

  for (const post of posts as RlcPost[]) {
    if (post.featured_image_url) {
      const normalized = normalizeUrl(post.featured_image_url);
      if (isWordPressImageUrl(normalized)) {
        allUrls.add(normalized);
      }
    }
    if (post.content) {
      for (const url of extractImageUrls(post.content)) {
        allUrls.add(url);
      }
    }
  }

  console.log(`  Found ${allUrls.size} unique WordPress image URLs`);

  if (allUrls.size === 0) {
    console.log('\nNo WordPress images to migrate. Done.');
    process.exit(0);
  }

  // 4. Download and upload each image
  console.log('\nStep 4: Migrating images...');
  const stats: MigrationStats = {
    downloaded: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    rewrittenFeatured: 0,
    rewrittenContent: 0,
    errors: [],
  };

  const urlToPathMap = new Map<string, string>();
  const urlToNewUrl = new Map<string, string>();
  const urlArray = Array.from(allUrls);

  // Process sequentially to avoid overwhelming the old server
  for (let i = 0; i < urlArray.length; i++) {
    const originalUrl = urlArray[i];
    const newUrl = await migrateImage(originalUrl, urlToPathMap, stats, dryRun);
    if (newUrl) {
      urlToNewUrl.set(originalUrl, newUrl);
    }
    process.stdout.write(
      `  Progress: ${i + 1}/${urlArray.length} (${stats.downloaded} downloaded, ${stats.skipped} skipped, ${stats.failed} failed)\r`
    );
  }
  console.log(); // newline after progress

  // 5. Rewrite URLs in database
  console.log('\nStep 5: Rewriting URLs in database...');

  for (const post of posts as RlcPost[]) {
    let featuredUpdated = false;
    let contentUpdated = false;
    const updates: Record<string, unknown> = {};

    // Featured image
    if (post.featured_image_url) {
      const normalized = normalizeUrl(post.featured_image_url);
      const newUrl = urlToNewUrl.get(normalized);
      if (newUrl) {
        updates.featured_image_url = newUrl;
        featuredUpdated = true;
      }
    }

    // Content inline images
    if (post.content) {
      const rewritten = rewriteContentUrls(post.content, urlToNewUrl);
      if (rewritten !== post.content) {
        updates.content = rewritten;
        contentUpdated = true;
      }
    }

    if (Object.keys(updates).length > 0) {
      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('rlc_posts')
          .update(updates)
          .eq('id', post.id);

        if (updateError) {
          stats.errors.push(`DB update failed for post ${post.id}: ${updateError.message}`);
        }
      }

      if (featuredUpdated) stats.rewrittenFeatured++;
      if (contentUpdated) stats.rewrittenContent++;
    }
  }

  // 6. Summary
  console.log('\n==========================================');
  console.log('Migration Summary');
  console.log('==========================================');
  if (dryRun) console.log('  [DRY RUN — no actual changes made]');
  console.log(`  Images downloaded:        ${stats.downloaded}`);
  console.log(`  Images uploaded:          ${stats.uploaded}`);
  console.log(`  Images skipped (exist):   ${stats.skipped}`);
  console.log(`  Images failed:            ${stats.failed}`);
  console.log(`  Featured URLs rewritten:  ${stats.rewrittenFeatured}`);
  console.log(`  Content HTML rewritten:   ${stats.rewrittenContent}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    for (const e of stats.errors) {
      console.log(`  - ${e}`);
    }
  }

  console.log('\nDone.');
  process.exit(stats.failed > 0 && stats.downloaded === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
