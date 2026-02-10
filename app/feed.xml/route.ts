import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { BASE_URL } from '@/lib/constants';

interface FeedPost {
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_posts')
    .select('title, slug, excerpt, published_at')
    .eq('status', 'published')
    .eq('content_type', 'post')
    .order('published_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('RSS feed: failed to fetch posts:', error);
    return new Response('Internal Server Error', { status: 500 });
  }

  const posts = (data || []) as FeedPost[];

  const items = posts
    .map((post) => {
      const pubDate = post.published_at
        ? new Date(post.published_at).toUTCString()
        : new Date().toUTCString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || '')}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join('\n');

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Republican Liberty Caucus</title>
    <link>${BASE_URL}</link>
    <description>News and updates from the Republican Liberty Caucus — advancing individual rights, limited government, and free markets.</description>
    <language>en-us</language>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
