import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { shareEventCreateSchema } from '@/lib/validations/share-kit';
import { getOrCreateShareLink } from '@/lib/share/tracking';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = shareEventCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { shareKitId, platform } = parseResult.data;

    const link = await getOrCreateShareLink(shareKitId, member.id);
    if (!link) {
      return apiError('Failed to resolve share link', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('rlc_share_events')
      .insert({
        share_link_id: link.id,
        platform,
      } as never);

    if (error) {
      logger.error('Failed to record share event:', { shareLinkId: link.id, platform, error });
      return apiError('Failed to record share event', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Unhandled error in share-events POST:', { error: err });
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
