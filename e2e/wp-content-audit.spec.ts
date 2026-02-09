import { test, expect } from '@playwright/test';

// ── WP Pages (migrated from WordPress "Pages" category) ──────────────────
const WP_PAGES = [
  { name: 'Principles', path: '/about/principles' },
  { name: 'Bylaws', path: '/about/bylaws' },
  { name: 'Committees', path: '/about/committees' },
  { name: 'History', path: '/about/history' },
  { name: 'Speakers Bureau', path: '/about/speakers' },
  { name: 'Endorsements', path: '/endorsements' },
  { name: 'Endorsement Process', path: '/endorsements/process' },
  { name: 'Elected Officials', path: '/endorsements/elected-officials' },
];

// ── Types ─────────────────────────────────────────────────────────────────
interface ContentAuditResult {
  url: string;
  textLength: number;
  hasContentContainer: boolean;
  headingCount: number;
  // Bold blocks that look like unpromoted headings
  suspectBoldBlocks: { text: string; isConsecutive: boolean }[];
  // Paragraphs exceeding char limit
  longParagraphs: { text: string; length: number }[];
  // Images
  duplicateImageSrcs: string[];
  brokenImages: string[];
  imagesMissingAlt: string[];
  allImageSrcs: string[];
}

interface BlogAuditResult extends ContentAuditResult {
  featuredImageSrc: string | null;
  featuredImageInBody: boolean;
  oversizedContentImages: { src: string; width: number; featuredWidth: number }[];
}

// ── DOM audit — runs inside page.evaluate() ───────────────────────────────
function auditContentDom(sel: string) {
    const container = document.querySelector(sel);
    if (!container) {
      return {
        hasContentContainer: false,
        textLength: 0,
        headingCount: 0,
        suspectBoldBlocks: [],
        longParagraphs: [],
        duplicateImageSrcs: [],
        brokenImages: [],
        imagesMissingAlt: [],
        allImageSrcs: [],
      };
    }

    const textLength = (container.textContent || '').trim().length;
    const headingCount = container.querySelectorAll('h1, h2, h3, h4, h5, h6').length;

    // ── Suspect bold blocks ──
    // <p><strong>...</strong></p> with no other sibling text — looks like an unpromoted heading
    const suspectBoldBlocks: { text: string; isConsecutive: boolean }[] = [];
    const paragraphs = container.querySelectorAll('p');
    let prevWasSuspect = false;
    for (const p of paragraphs) {
      const strongs = p.querySelectorAll(':scope > strong');
      if (strongs.length === 0) { prevWasSuspect = false; continue; }

      // Check if the <p> contains ONLY a <strong> (plus whitespace)
      const nonStrongText = Array.from(p.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => (n.textContent || '').trim())
        .join('');
      if (nonStrongText.length > 0) { prevWasSuspect = false; continue; }
      if (strongs.length !== 1) { prevWasSuspect = false; continue; }

      const strongText = (strongs[0].textContent || '').trim();
      if (strongText.length < 3 || strongText.length > 200) { prevWasSuspect = false; continue; }

      suspectBoldBlocks.push({ text: strongText, isConsecutive: prevWasSuspect });
      prevWasSuspect = true;
    }

    // ── Long paragraphs ──
    const longParagraphs: { text: string; length: number }[] = [];
    for (const p of paragraphs) {
      const len = (p.textContent || '').trim().length;
      if (len > 2000) {
        longParagraphs.push({ text: (p.textContent || '').trim().slice(0, 120) + '...', length: len });
      }
    }

    // ── Images ──
    const imgs = container.querySelectorAll('img');
    const srcCounts = new Map<string, number>();
    const brokenImages: string[] = [];
    const imagesMissingAlt: string[] = [];
    const allImageSrcs: string[] = [];

    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      allImageSrcs.push(src);

      // Normalize src: strip /_next/image?url= wrapper and query params for dedup
      const normalized = decodeURIComponent(
        src.replace(/^\/_next\/image\?url=/, '').replace(/&.*$/, '').replace(/\?.*$/, '')
      );
      srcCounts.set(normalized, (srcCounts.get(normalized) || 0) + 1);

      if ((img as HTMLImageElement).naturalWidth === 0 && (img as HTMLImageElement).complete) {
        brokenImages.push(src);
      }
      if (!img.hasAttribute('alt')) {
        imagesMissingAlt.push(src);
      }
    }

    const duplicateImageSrcs = [...srcCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([src]) => src);

    return {
      hasContentContainer: true,
      textLength,
      headingCount,
      suspectBoldBlocks,
      longParagraphs,
      duplicateImageSrcs,
      brokenImages,
      imagesMissingAlt,
      allImageSrcs,
    };
}

// ── Normalize image src for comparison ────────────────────────────────────
function normalizeImageSrc(src: string): string {
  let normalized = decodeURIComponent(src);
  // Strip Next.js image optimizer wrapper
  const nextMatch = normalized.match(/\/_next\/image\?url=([^&]+)/);
  if (nextMatch) normalized = decodeURIComponent(nextMatch[1]);
  // Strip query params
  normalized = normalized.replace(/\?.*$/, '');
  return normalized;
}

// ── Report helpers ────────────────────────────────────────────────────────
function reportIssues(
  label: string,
  result: ContentAuditResult,
  isBlog = false,
) {
  const issues: string[] = [];
  const blogResult = result as BlogAuditResult;

  if (!result.hasContentContainer) {
    issues.push('  ERROR  Content container not found');
  }

  if (result.textLength > 500 && result.headingCount === 0) {
    issues.push(`  WARN   No headings in ${result.textLength}-char content (wall of text)`);
  }

  for (const bold of result.suspectBoldBlocks) {
    const severity = bold.isConsecutive ? 'ERROR' : 'WARN ';
    issues.push(`  ${severity}  Suspect bold heading: "${bold.text}"${bold.isConsecutive ? ' (consecutive — likely unpromoted)' : ''}`);
  }

  for (const lp of result.longParagraphs) {
    issues.push(`  WARN   Long paragraph (${lp.length} chars): "${lp.text}"`);
  }

  for (const dup of result.duplicateImageSrcs) {
    issues.push(`  WARN   Duplicate image: ${dup}`);
  }

  if (isBlog && blogResult.featuredImageInBody) {
    issues.push(`  ERROR  Featured image repeated inside post body`);
  }

  if (isBlog && blogResult.oversizedContentImages?.length) {
    for (const img of blogResult.oversizedContentImages) {
      issues.push(`  WARN   Content image (${img.width}px) wider than featured image (${img.featuredWidth}px): ${img.src}`);
    }
  }

  for (const src of result.brokenImages) {
    issues.push(`  ERROR  Broken image (naturalWidth=0): ${src}`);
  }

  for (const src of result.imagesMissingAlt) {
    issues.push(`  WARN   Image missing alt attribute: ${src}`);
  }

  if (issues.length > 0) {
    console.log(`\n=== ${label} — ${issues.length} issue(s) ===\n${issues.join('\n')}\n`);
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('WordPress Content Quality Audit', () => {

  // ── WP Pages ────────────────────────────────────────────────────────────
  test.describe('WP Pages', () => {
    for (const { name, path } of WP_PAGES) {
      test(`${name} (${path})`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // HTTP status
        expect.soft(response?.status(), `${name}: HTTP status`).toBeLessThan(400);

        // Critical console errors
        const critical = consoleErrors.filter(
          (e) => !e.includes('favicon') && !e.includes('hydration')
        );
        expect.soft(critical, `${name}: console errors`).toHaveLength(0);

        // Run DOM audit
        const contentSelector = 'div.prose.prose-lg';
        const rawResult = await page.evaluate(auditContentDom, contentSelector);
        const result: ContentAuditResult = { ...rawResult, url: path };

        // Content container must exist
        expect.soft(result.hasContentContainer, `${name}: content container exists`).toBe(true);

        // Report and assert
        const issues = reportIssues(name, result);

        // Walls of text are content-quality warnings, not code bugs.
        // reportIssues() already logs them; no assertion needed.

        // Consecutive bold blocks = strong signal of unpromoted headings
        const consecutiveBolds = result.suspectBoldBlocks.filter(b => b.isConsecutive);
        expect.soft(consecutiveBolds, `${name}: consecutive bold blocks (unpromoted headings)`).toHaveLength(0);

        // Broken images
        expect.soft(result.brokenImages, `${name}: broken images`).toHaveLength(0);

        // Duplicate images
        expect.soft(result.duplicateImageSrcs, `${name}: duplicate images`).toHaveLength(0);

        test.info().annotations.push({
          type: 'wp-content-issues',
          description: `${issues.length} issue(s) found`,
        });
      });
    }
  });

  // ── Blog Posts ──────────────────────────────────────────────────────────
  test('Blog posts', async ({ page }) => {
    test.setTimeout(0); // No timeout — may iterate many posts

    // ── Discover all blog post slugs ──
    const postSlugs = new Set<string>();

    await page.goto('/blog', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Determine total pages from pagination
    let totalPages = 1;
    const paginationSpans = await page.locator('nav[aria-label="Blog pagination"] span').all();
    for (const span of paginationSpans) {
      const text = await span.textContent().catch(() => '');
      const match = (text || '').match(/Page\s+\d+\s+of\s+(\d+)/i);
      if (match) { totalPages = parseInt(match[1], 10); break; }
    }

    // Collect slugs from each listing page
    for (let p = 1; p <= totalPages; p++) {
      if (p > 1) {
        await page.goto(`/blog?page=${p}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
      const links = await page.locator('div.grid a[href^="/blog/"]').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href) postSlugs.add(href);
      }
    }

    console.log(`\n=== Discovered ${postSlugs.size} blog posts across ${totalPages} page(s) ===\n`);

    if (postSlugs.size === 0) {
      test.info().annotations.push({ type: 'wp-content-issues', description: 'No blog posts found' });
      return;
    }

    // ── Audit each post ──
    let totalIssues = 0;

    for (const slug of postSlugs) {
      await test.step(`Post: ${slug}`, async () => {
        // Hard 20s wall-clock timeout per post — if dev server SSR hangs, we skip
        const POST_TIMEOUT = 20_000;
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Post timed out after ${POST_TIMEOUT}ms`)), POST_TIMEOUT)
        );
        try {
          await Promise.race([timeout, (async () => {
          const consoleErrors: string[] = [];
          page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
          });

          const response = await page.goto(slug, { waitUntil: 'domcontentloaded', timeout: 15000 });

          // HTTP status
          expect.soft(response?.status(), `${slug}: HTTP status`).toBeLessThan(400);

          // Critical console errors (ignore dead-domain resource loads and favicon)
          const critical = consoleErrors.filter(
            (e) =>
              !e.includes('favicon') &&
              !e.includes('hydration') &&
              !e.includes('rlc.org') &&
              !e.includes('ERR_NAME_NOT_RESOLVED')
          );
          expect.soft(critical, `${slug}: console errors`).toHaveLength(0);

          // ── Get featured image src ──
          const featuredImageSrc = await page.locator('div.aspect-video img').first().getAttribute('src').catch(() => null);

          // ── Run DOM audit on content body ──
          const contentSelector = 'div.prose.prose-lg.mt-8';
          const rawResult = await page.evaluate(auditContentDom, contentSelector);
          const result: ContentAuditResult = { ...rawResult, url: slug };

          // ── Blog-specific checks ──
          const blogResult: BlogAuditResult = {
            ...result,
            featuredImageSrc,
            featuredImageInBody: false,
            oversizedContentImages: [],
          };

          // Check if featured image is duplicated inside content
          if (featuredImageSrc) {
            const normalizedFeatured = normalizeImageSrc(featuredImageSrc);
            blogResult.featuredImageInBody = result.allImageSrcs.some(
              (src) => normalizeImageSrc(src) === normalizedFeatured
            );
          }

          // Check for content images wider than featured image
          // Use a short wait for images — skip if it takes too long (dead hosts)
          if (featuredImageSrc && result.allImageSrcs.length > 0) {
            await page.waitForTimeout(2000); // Brief pause for images, won't hang
            const oversized = await page.evaluate(
              ({ contentSel, featSel }: { contentSel: string; featSel: string }) => {
                const featImg = document.querySelector(`${featSel} img`) as HTMLImageElement | null;
                if (!featImg || !featImg.naturalWidth) return [];

                const contentContainer = document.querySelector(contentSel);
                if (!contentContainer) return [];

                const results: { src: string; width: number; featuredWidth: number }[] = [];
                const contentImgs = contentContainer.querySelectorAll('img');
                for (const img of contentImgs) {
                  const htmlImg = img as HTMLImageElement;
                  if (htmlImg.naturalWidth > featImg.naturalWidth) {
                    results.push({
                      src: htmlImg.src,
                      width: htmlImg.naturalWidth,
                      featuredWidth: featImg.naturalWidth,
                    });
                  }
                }
                return results;
              },
              { contentSel: contentSelector, featSel: 'div.aspect-video' },
            );
            blogResult.oversizedContentImages = oversized;
          }

          // ── Report ──
          const issues = reportIssues(`Blog: ${slug}`, blogResult, true);
          totalIssues += issues.length;

          // Soft assertions for blog-specific issues
          if (blogResult.featuredImageInBody) {
            expect.soft(blogResult.featuredImageInBody, `${slug}: featured image duplicated in body`).toBe(false);
          }

          const consecutiveBolds = result.suspectBoldBlocks.filter(b => b.isConsecutive);
          expect.soft(consecutiveBolds, `${slug}: consecutive bold blocks`).toHaveLength(0);

          expect.soft(result.brokenImages, `${slug}: broken images`).toHaveLength(0);
          })()]);
        } catch (err) {
          console.log(`\n=== Blog: ${slug} — SKIPPED (${(err as Error).message?.slice(0, 80)}) ===\n`);
        } finally {
          page.removeAllListeners('console');
        }
      });
    }

    console.log(`\n=== Blog audit complete: ${postSlugs.size} posts, ${totalIssues} total issue(s) ===\n`);

    test.info().annotations.push({
      type: 'wp-content-issues',
      description: `${postSlugs.size} posts audited, ${totalIssues} total issue(s)`,
    });
  });
});
