import { NextResponse } from 'next/server';
import { postCreateSchema } from '@/lib/validations/post';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = postCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;

  // Scoped admins can only create posts for their visible charters
  if (input.charterId && ctx.visibleCharterIds !== null) {
    if (!ctx.visibleCharterIds.includes(input.charterId)) {
      return apiError('Cannot create post for a charter outside your scope', ApiErrorCode.FORBIDDEN, 403);
    }
  }

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
      charter_id: input.charterId || null,
      status: input.status,
      published_at: input.status === 'published' ? new Date().toISOString() : null,
      categories: input.categories,
      tags: input.tags,
      seo_title: input.seoTitle || null,
      seo_description: input.seoDescription || null,
      content_type: input.contentType || 'post',
      metadata: {},
      updated_at: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (error) {
    logger.error('Error creating post:', error);
    return apiError('Failed to create post', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
