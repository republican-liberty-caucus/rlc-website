import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { postCreateSchema } from '@/lib/validations/post';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = postCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  // Scoped admins can only create posts for their visible chapters
  if (input.chapterId && ctx.visibleChapterIds !== null) {
    if (!ctx.visibleChapterIds.includes(input.chapterId)) {
      return NextResponse.json(
        { error: 'Cannot create post for a chapter outside your scope' },
        { status: 403 }
      );
    }
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_posts')
    .insert({
      id: crypto.randomUUID(),
      title: input.title,
      slug: input.slug,
      content: input.content || null,
      excerpt: input.excerpt || null,
      featured_image_url: input.featuredImageUrl || null,
      author_id: ctx.member.id,
      chapter_id: input.chapterId || null,
      status: input.status,
      published_at: input.status === 'published' ? new Date().toISOString() : null,
      categories: input.categories,
      tags: input.tags,
      seo_title: input.seoTitle || null,
      seo_description: input.seoDescription || null,
      metadata: {},
      updated_at: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (error) {
    logger.error('Error creating post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
