import sanitizeHtml from 'sanitize-html';
import { createServerClient } from '@/lib/supabase/server';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img',
    'iframe',
    'figure',
    'figcaption',
    'video',
    'source',
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'loading'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'title'],
    video: ['src', 'controls', 'width', 'height'],
    source: ['src', 'type'],
    '*': ['class', 'id', 'style'],
  },
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com', 'rumble.com'],
};

/**
 * Promote <strong>-wrapped headings to proper HTML heading elements.
 * WordPress content often uses bold text for structural headings (Article, Section,
 * Rule, topic names) instead of proper <h2>/<h3>. This runs BEFORE wpautop()
 * so the block-level headings get proper paragraph separation.
 */
function promoteHeadings(html: string): string {
  if (!html) return '';
  try {
    let output = html;

    // Normalize line endings for consistent matching
    output = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove empty/whitespace-only bold tags
    output = output.replace(/<strong>(?:\s|&nbsp;)*<\/strong>/gi, '');

    // --- Content WITH <p> tags (committees, speakers, etc.) ---
    // <p><strong>Title</strong></p> → <h3> (or <h2> for Articles)
    // Skip if inner content contains <img> or nested <strong>
    output = output.replace(
      /<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>(?:\s|&nbsp;)*<\/p>/gi,
      (_match, inner: string) => {
        if (/<img/i.test(inner)) return _match;
        if (/<strong/i.test(inner)) return _match;
        const clean = inner.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, ' ').trim();
        if (!clean) return '';
        if (/^Article\s+/i.test(clean)) return `<h2>${clean}</h2>`;
        return `<h3>${clean}</h3>`;
      },
    );

    // --- Content WITHOUT <p> tags (bylaws, principles) ---

    // Article / "Caucus Rules" → <h2>
    output = output.replace(
      /<strong>((?:Article\s+[^<]+|Caucus Rules))<\/strong>/gi,
      '\n\n<h2>$1</h2>\n\n',
    );

    // Rule / Section headings → <h3>
    // Section is often followed immediately by text: <strong>Section 1:</strong>Text here...
    // The inserted newlines let wpautop wrap the trailing text in its own <p>.
    output = output.replace(
      /<strong>((?:Rule\s+\d+\.\s+[^<]+|Section\s+\d+\s*:))<\/strong>/gi,
      '\n\n<h3>$1</h3>\n\n',
    );

    // Standalone bold topic headers on their own line (principles: "Bill of Rights", "Taxation", etc.)
    // Must be >4 chars, start with uppercase, alone on a line, and not a letter label (A. B.)
    output = output.replace(
      /^<strong>([A-Z][^<]{4,})<\/strong>$/gm,
      (_match, inner: string) => {
        const trimmed = inner.trim();
        if (/^[A-Z]\.\s/.test(trimmed)) return _match;
        return `<h3>${trimmed}</h3>`;
      },
    );

    return output;
  } catch {
    // Return original HTML rather than crashing the page render
    console.error('[promoteHeadings] Failed to transform content, returning original HTML');
    return html;
  }
}

/**
 * Port of WordPress's wpautop() — converts double newlines to <p> tags
 * and single newlines to <br>. Skips content already wrapped in block-level
 * HTML elements.
 */
function wpautop(text: string): string {
  if (!text || !text.trim()) return '';

  // If content already has <p> tags, assume it's already formatted
  if (/<p[\s>]/i.test(text)) return text;

  let output = text;

  // Normalize line endings
  output = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Block-level elements that should not be wrapped in <p>
  const blockTags =
    'address|article|aside|blockquote|details|dialog|dd|div|dl|dt|' +
    'fieldset|figcaption|figure|footer|form|h[1-6]|header|hgroup|hr|' +
    'li|main|nav|ol|p|pre|section|table|ul';

  // Preserve existing block-level elements by adding double newlines around them
  const blockRegex = new RegExp(
    `(</?(?:${blockTags})[^>]*>)`,
    'gi'
  );
  output = output.replace(blockRegex, '\n\n$1\n\n');

  // Collapse multiple newlines
  output = output.replace(/\n{3,}/g, '\n\n');

  // Split into paragraphs on double newlines
  const paragraphs = output.split(/\n\n+/).filter((p) => p.trim());

  // Wrap non-block-level content in <p> tags
  const blockStartRegex = new RegExp(`^</?(?:${blockTags})[\\s>]`, 'i');

  output = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Don't wrap if it starts with a block-level element
      if (blockStartRegex.test(trimmed)) return trimmed;
      // Convert single newlines to <br> within the paragraph
      return '<p>' + trimmed.replace(/\n/g, '<br>\n') + '</p>';
    })
    .join('\n');

  return output;
}

/** Sanitize WordPress HTML for safe rendering */
export function sanitizeWPContent(html: string): string {
  return sanitizeHtml(wpautop(promoteHeadings(html)), SANITIZE_OPTIONS);
}

interface WPPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
}

/** Fetch a WordPress "Pages" category item by slug */
export async function getWPPageContent(slug: string): Promise<WPPage | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_posts')
    .select('id, title, slug, content, excerpt')
    .eq('slug', slug)
    .contains('categories', ['Pages'])
    .single();

  if (error || !data) return null;
  return data as WPPage;
}
