import { NextResponse } from 'next/server';
import { shareKitUpdateSchema } from '@/lib/validations/share-kit';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const result = await requireAdminApi();
    if (result.error) return result.error;
    const { ctx, supabase } = result;

    const { id } = await params;

    const { data: kit, error } = await supabase
      .from('rlc_share_kits')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Share kit not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Failed to fetch share kit:', { id, error });
      return apiError('Failed to fetch share kit', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    // Charter-scoped authorization
    const kitRow = kit as { charter_id: string | null };
    if (ctx.visibleCharterIds !== null && kitRow.charter_id && !ctx.visibleCharterIds.includes(kitRow.charter_id)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    // Get share stats — fetch link IDs once, reuse for both counts
    const { data: links, error: linksError } = await supabase
      .from('rlc_share_links')
      .select('id')
      .eq('share_kit_id', id);

    if (linksError) {
      logger.error('Failed to fetch share links for stats:', { shareKitId: id, error: linksError });
      return apiError('Failed to fetch share kit stats', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const linkIds = (links || []).map((l: { id: string }) => l.id);
    let shareCount = 0;
    let clickCount = 0;

    if (linkIds.length > 0) {
      const { count: shares, error: sharesError } = await supabase
        .from('rlc_share_events')
        .select('id', { count: 'exact', head: true })
        .in('share_link_id', linkIds);

      if (sharesError) {
        logger.error('Failed to count share events:', { shareKitId: id, error: sharesError });
      } else {
        shareCount = shares || 0;
      }

      const { count: clicks, error: clicksError } = await supabase
        .from('rlc_link_clicks')
        .select('id', { count: 'exact', head: true })
        .in('share_link_id', linkIds);

      if (clicksError) {
        logger.error('Failed to count link clicks:', { shareKitId: id, error: clicksError });
      } else {
        clickCount = clicks || 0;
      }
    }

    return NextResponse.json({
      shareKit: kit,
      stats: {
        shares: shareCount,
        clicks: clickCount,
      },
    });
  } catch (err) {
    logger.error('Unhandled error in share-kits GET:', { error: err });
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const result = await requireAdminApi();
    if (result.error) return result.error;
    const { ctx, supabase } = result;

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = shareKitUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    // Charter-scoped authorization — fetch kit first to check access
    const { data: existing, error: fetchError } = await supabase
      .from('rlc_share_kits')
      .select('charter_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return apiError('Share kit not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Failed to fetch share kit for auth check:', { id, error: fetchError });
      return apiError('Failed to update share kit', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const existingRow = existing as { charter_id: string | null };
    if (ctx.visibleCharterIds !== null && existingRow.charter_id && !ctx.visibleCharterIds.includes(existingRow.charter_id)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const updates: Record<string, unknown> = {};
    if (parseResult.data.title !== undefined) updates.title = parseResult.data.title;
    if (parseResult.data.description !== undefined) updates.description = parseResult.data.description;
    if (parseResult.data.socialCopy !== undefined) updates.social_copy = parseResult.data.socialCopy;
    if (parseResult.data.ogImageOverrideUrl !== undefined) updates.og_image_override_url = parseResult.data.ogImageOverrideUrl;
    if (parseResult.data.status !== undefined) updates.status = parseResult.data.status;

    if (Object.keys(updates).length === 0) {
      return apiError('No fields to update', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    const { data, error } = await supabase
      .from('rlc_share_kits')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Share kit not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error updating share kit:', { id, error });
      return apiError('Failed to update share kit', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ shareKit: data });
  } catch (err) {
    logger.error('Unhandled error in share-kits PATCH:', { error: err });
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
