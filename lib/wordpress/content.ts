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

/** Sanitize WordPress HTML for safe rendering */
export function sanitizeWPContent(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
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
