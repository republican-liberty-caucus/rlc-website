import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { getOrCreateShareLink, buildTrackedUrl } from '@/lib/share/tracking';
import { shareLinkCreateSchema } from '@/lib/validations/share-kit';
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

    const parseResult = shareLinkCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const link = await getOrCreateShareLink(parseResult.data.shareKitId, member.id);
    if (!link) {
      return apiError('Failed to create share link', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({
      shareLink: {
        ...link,
        url: buildTrackedUrl(link.short_code),
      },
    });
  } catch (err) {
    logger.error('Unhandled error in share-links POST:', { error: err });
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
