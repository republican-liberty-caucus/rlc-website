import { NextResponse } from 'next/server';
import { postUpdateSchema } from '@/lib/validations/post';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id } = await params;

  // Fetch existing post
  const { data: existingData, error: fetchError } = await supabase
    .from('rlc_posts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingData) {
    return apiError('Post not found', ApiErrorCode.NOT_FOUND, 404);
  }

  const existing = existingData as { charter_id: string | null; published_at: string | null; [key: string]: unknown };

  // Check charter visibility
  if (existing.charter_id && ctx.visibleCharterIds !== null) {
    if (!ctx.visibleCharterIds.includes(existing.charter_id)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = postUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;

  // If changing charter, verify new charter is in scope
  if (input.charterId !== undefined && ctx.visibleCharterIds !== null) {
    if (input.charterId && !ctx.visibleCharterIds.includes(input.charterId)) {
      return apiError('Cannot move post to a charter outside your scope', ApiErrorCode.FORBIDDEN, 403);
    }
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.slug !== undefined) updatePayload.slug = input.slug;
  if (input.content !== undefined) updatePayload.content = input.content || null;
  if (input.excerpt !== undefined) updatePayload.excerpt = input.excerpt || null;
  if (input.featuredImageUrl !== undefined) updatePayload.featured_image_url = input.featuredImageUrl || null;
  if (input.charterId !== undefined) updatePayload.charter_id = input.charterId || null;
  if (input.categories !== undefined) updatePayload.categories = input.categories;
  if (input.tags !== undefined) updatePayload.tags = input.tags;
  if (input.seoTitle !== undefined) updatePayload.seo_title = input.seoTitle || null;
  if (input.seoDescription !== undefined) updatePayload.seo_description = input.seoDescription || null;
  if (input.contentType !== undefined) updatePayload.content_type = input.contentType;

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

  if (error || !data) {
    logger.error('Error updating post:', error);
    return apiError('Failed to update post', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  // Auto-advance vetting stage when a press release is published
  const updatedPost = data as { id: string; content_type: string; status: string };
  if (updatedPost.content_type === 'press_release' && updatedPost.status === 'published') {
    try {
      const { error: vettingAdvanceError } = await supabase
        .from('rlc_candidate_vettings')
        .update({ stage: 'press_release_published' } as never)
        .eq('press_release_post_id', id)
        .eq('stage', 'press_release_created');

      if (vettingAdvanceError) {
        logger.warn('Failed to auto-advance vetting on press release publish:', {
          postId: id,
          error: vettingAdvanceError,
        });
      }
    } catch (vettingErr) {
      logger.warn('Unexpected error auto-advancing vetting on press release publish:', {
        postId: id,
        error: vettingErr,
      });
    }
  }

  return NextResponse.json({ post: data });
}
