import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const category = searchParams.get('category');
  const tag = searchParams.get('tag');

  try {
    const supabase = createServerClient();

    let query = supabase
      .from('rlc_posts')
      .select(`
        id, title, slug, excerpt, featured_image_url,
        author:rlc_contacts(id, first_name, last_name),
        charter:rlc_charters(id, name, slug),
        status, published_at, categories, tags
      `)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.contains('categories', [category]);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data: posts, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ posts });
  } catch (error) {
    logger.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
