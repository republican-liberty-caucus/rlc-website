import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageOpponents, canDeleteOpponent } from '@/lib/vetting/permissions';
import { opponentUpdateSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

type RouteParams = { params: Promise<{ id: string; opponentId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canManageOpponents(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id, opponentId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = opponentUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const supabase = createServerClient();

    // Verify opponent belongs to this vetting
    const { data: rawExisting, error: fetchError } = await supabase
      .from('rlc_candidate_vetting_opponents')
      .select('id, vetting_id')
      .eq('id', opponentId)
      .single();

    const existing = rawExisting as unknown as { id: string; vetting_id: string } | null;

    if (fetchError || !existing) {
      return apiError('Opponent not found', ApiErrorCode.NOT_FOUND, 404);
    }
    if (existing.vetting_id !== id) {
      return apiError('Opponent not found', ApiErrorCode.NOT_FOUND, 404);
    }

    const d = parseResult.data;
    const updates: Record<string, unknown> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.party !== undefined) updates.party = d.party;
    if (d.isIncumbent !== undefined) updates.is_incumbent = d.isIncumbent;
    if (d.background !== undefined) updates.background = d.background;
    if (d.credibility !== undefined) updates.credibility = d.credibility;
    if (d.fundraising !== undefined) updates.fundraising = d.fundraising;
    if (d.endorsements !== undefined) updates.endorsements = d.endorsements;
    if (d.socialLinks !== undefined) updates.social_links = d.socialLinks;
    if (d.photoUrl !== undefined) updates.photo_url = d.photoUrl;

    if (Object.keys(updates).length === 0) {
      return apiError('No fields to update', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    const { data: updated, error: updateError } = await supabase
      .from('rlc_candidate_vetting_opponents')
      .update(updates as never)
      .eq('id', opponentId)
      .eq('vetting_id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating opponent:', { opponentId, error: updateError });
      return apiError('Failed to update opponent', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ opponent: updated });
  } catch (err) {
    logger.error('Unhandled error in PATCH opponents/[opponentId]:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canDeleteOpponent(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id, opponentId } = await params;
    const supabase = createServerClient();

    // Verify opponent belongs to this vetting
    const { data: rawDelExisting, error: fetchError } = await supabase
      .from('rlc_candidate_vetting_opponents')
      .select('id, vetting_id')
      .eq('id', opponentId)
      .single();

    const delExisting = rawDelExisting as unknown as { id: string; vetting_id: string } | null;

    if (fetchError || !delExisting) {
      return apiError('Opponent not found', ApiErrorCode.NOT_FOUND, 404);
    }
    if (delExisting.vetting_id !== id) {
      return apiError('Opponent not found', ApiErrorCode.NOT_FOUND, 404);
    }

    const { error: deleteError } = await supabase
      .from('rlc_candidate_vetting_opponents')
      .delete()
      .eq('id', opponentId)
      .eq('vetting_id', id);

    if (deleteError) {
      logger.error('Error deleting opponent:', { opponentId, error: deleteError });
      return apiError('Failed to delete opponent', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Unhandled error in DELETE opponents/[opponentId]:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
