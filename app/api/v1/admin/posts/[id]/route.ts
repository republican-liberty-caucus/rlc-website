import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { postUpdateSchema } from '@/lib/validations/post';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServerClient();

  // Fetch existing post
  const { data: existingData, error: fetchError } = await supabase
    .from('rlc_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingData) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const existing = existingData as { chapter_id: string | null; published_at: string | null; [key: string]: unknown };

  // Check chapter visibility
  if (existing.chapter_id && ctx.visibleChapterIds !== null) {
    if (!ctx.visibleChapterIds.includes(existing.chapter_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = postUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  // If changing chapter, verify new chapter is in scope
  if (input.chapterId !== undefined && ctx.visibleChapterIds !== null) {
    if (input.chapterId && !ctx.visibleChapterIds.includes(input.chapterId)) {
      return NextResponse.json(
        { error: 'Cannot move post to a chapter outside your scope' },
        { status: 403 }
      );
    }
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.slug !== undefined) updatePayload.slug = input.slug;
  if (input.content !== undefined) updatePayload.content = input.content || null;
  if (input.excerpt !== undefined) updatePayload.excerpt = input.excerpt || null;
  if (input.featuredImageUrl !== undefined) updatePayload.featured_image_url = input.featuredImageUrl || null;
  if (input.chapterId !== undefined) updatePayload.chapter_id = input.chapterId || null;
  if (input.categories !== undefined) updatePayload.categories = input.categories;
  if (input.tags !== undefined) updatePayload.tags = input.tags;
  if (input.seoTitle !== undefined) updatePayload.seo_title = input.seoTitle || null;
  if (input.seoDescription !== undefined) updatePayload.seo_description = input.seoDescription || null;

  // Set published_at when first publishing
  if (input.status !== undefined) {
    updatePayload.status = input.status;
    if (input.status === 'published' && !existing.published_at) {
      updatePayload.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('rlc_posts')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating post:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}
