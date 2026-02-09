import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG contrast ratio helpers.
 * Relative luminance per WCAG 2.0: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    };
  }
  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface ContrastIssue {
  text: string;
  selector: string;
  color: string;
  bgColor: string;
  ratio: number;
  fontSize: string;
  required: number;
}

/**
 * Crawl visible text elements and check contrast against their effective background.
 * Returns an array of elements failing WCAG AA contrast requirements.
 */
async function findContrastIssues(page: Page): Promise<ContrastIssue[]> {
  return page.evaluate(() => {
    function parseCSSColor(color: string) {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return {
        r: parseInt(m[1], 10),
        g: parseInt(m[2], 10),
        b: parseInt(m[3], 10),
        a: m[4] !== undefined ? parseFloat(m[4]) : 1,
      };
    }

    function getLuminance(r: number, g: number, b: number) {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function getContrastRatio(
      fg: { r: number; g: number; b: number },
      bg: { r: number; g: number; b: number }
    ) {
      const l1 = getLuminance(fg.r, fg.g, fg.b);
      const l2 = getLuminance(bg.r, bg.g, bg.b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    // Blend foreground color with alpha over background
    function blendAlpha(
      fg: { r: number; g: number; b: number; a: number },
      bg: { r: number; g: number; b: number }
    ) {
      return {
        r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
        g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
        b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
      };
    }

    // Walk up the DOM to find the effective background color
    function getEffectiveBgColor(el: Element): { r: number; g: number; b: number } {
      let current: Element | null = el;
      while (current) {
        const style = window.getComputedStyle(current);
        const bg = parseCSSColor(style.backgroundColor);
        if (bg && bg.a > 0) {
          if (bg.a >= 1) return { r: bg.r, g: bg.g, b: bg.b };
          // Semi-transparent — keep walking for what's behind it
          const parentBg = current.parentElement
            ? getEffectiveBgColor(current.parentElement)
            : { r: 255, g: 255, b: 255 };
          return blendAlpha(bg, parentBg);
        }
        current = current.parentElement;
      }
      return { r: 255, g: 255, b: 255 }; // Default white
    }

    function getCSSPath(el: Element): string {
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
          selector += `#${current.id}`;
          parts.unshift(selector);
          break;
        }
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).slice(0, 2).join('.');
          if (classes) selector += `.${classes}`;
        }
        parts.unshift(selector);
        current = current.parentElement;
      }
      return parts.join(' > ');
    }

    const issues: {
      text: string;
      selector: string;
      color: string;
      bgColor: string;
      ratio: number;
      fontSize: string;
      required: number;
    }[] = [];

    // Check all visible text-containing elements
    const textElements = document.querySelectorAll(
      'p, span, a, h1, h2, h3, h4, h5, h6, li, td, th, label, button, div, dt, dd'
    );

    for (const el of textElements) {
      // Only check elements with direct text content
      const hasDirectText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim().length > 0
      );
      if (!hasDirectText) continue;

      const style = window.getComputedStyle(el);

      // Skip hidden/invisible elements
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        el.closest('[aria-hidden="true"]')
      ) continue;

      // Skip elements not in viewport
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const fgColor = parseCSSColor(style.color);
      if (!fgColor) continue;

      const bgColor = getEffectiveBgColor(el);

      // Blend foreground alpha
      const effectiveFg = fgColor.a < 1 ? blendAlpha(fgColor, bgColor) : fgColor;

      const ratio = getContrastRatio(effectiveFg, bgColor);

      // WCAG AA requirements
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight, 10) || 400;
      const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const requiredRatio = isLargeText ? 3 : 4.5;

      if (ratio < requiredRatio) {
        const textContent = (el.textContent || '').trim().slice(0, 80);
        if (!textContent) continue;

        issues.push({
          text: textContent,
          selector: getCSSPath(el),
          color: style.color,
          bgColor: `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`,
          ratio: Math.round(ratio * 100) / 100,
          fontSize: style.fontSize,
          required: requiredRatio,
        });
      }
    }

    // Deduplicate by selector (keep first occurrence)
    const seen = new Set<string>();
    return issues.filter((i) => {
      const key = `${i.selector}|${i.color}|${i.bgColor}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

// Pages to test (public, no auth required)
const PUBLIC_PAGES = [
  { name: 'Homepage', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Blog', path: '/blog' },
  { name: 'Events', path: '/events' },
  { name: 'Charters', path: '/charters' },
  { name: 'Scorecards', path: '/scorecards' },
  { name: 'Action Center', path: '/action-center' },
  { name: 'Join', path: '/join' },
  { name: 'Donate', path: '/donate' },
  { name: 'Contact', path: '/contact' },
  { name: 'Volunteer', path: '/volunteer' },
];

test.describe('UI Contrast & Accessibility Audit', () => {
  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} (${path}) — WCAG AA contrast check`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      const response = await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });

      // Page should load successfully
      expect(response?.status()).toBeLessThan(400);

      // Check for console errors
      const criticalErrors = errors.filter(
        (e) => !e.includes('favicon') && !e.includes('hydration')
      );

      // Find contrast issues
      const issues = await findContrastIssues(page);

      // Report all issues found
      if (issues.length > 0) {
        const report = issues
          .sort((a, b) => a.ratio - b.ratio) // worst first
          .map(
            (i) =>
              `  FAIL [${i.ratio}:1 < ${i.required}:1] "${i.text}"\n` +
              `       color: ${i.color} on ${i.bgColor} | font: ${i.fontSize}\n` +
              `       selector: ${i.selector}`
          )
          .join('\n\n');

        console.log(`\n=== ${name} (${path}) — ${issues.length} contrast issue(s) ===\n\n${report}\n`);
      }

      // Soft assertion: log issues but track count
      // Change to expect(issues).toHaveLength(0) to make it a hard failure
      test.info().annotations.push({
        type: 'contrast-issues',
        description: `${issues.length} issue(s) found`,
      });

      if (issues.length > 0) {
        // Fail with detailed report
        expect.soft(issues, `${issues.length} contrast issues on ${name}`).toHaveLength(0);
      }
    });

    test(`${name} (${path}) — axe accessibility scan`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['region']) // layout rule, noisy
        .analyze();

      const violations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');

      if (violations.length > 0) {
        const report = violations
          .map((v) => {
            const nodes = v.nodes
              .slice(0, 3)
              .map((n) => `    - ${n.target.join(' ')} : ${n.failureSummary}`)
              .join('\n');
            return `  [${v.impact}] ${v.id}: ${v.description}\n${nodes}`;
          })
          .join('\n\n');

        console.log(`\n=== ${name} (${path}) — ${violations.length} axe violation(s) ===\n\n${report}\n`);
      }

      expect.soft(
        violations,
        `${violations.length} critical/serious accessibility violations on ${name}`
      ).toHaveLength(0);
    });
  }
});
