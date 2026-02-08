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
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'title'],
    video: ['src', 'controls', 'width', 'height'],
    source: ['src', 'type'],
    '*': ['class', 'id', 'style'],
  },
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com', 'rumble.com'],
};

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
  return sanitizeHtml(wpautop(html), SANITIZE_OPTIONS);
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
