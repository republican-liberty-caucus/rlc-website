import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline, canManageOpponents } from '@/lib/vetting/permissions';
import { opponentCreateSchema } from '@/lib/validations/vetting';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canViewPipeline(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('rlc_candidate_vetting_opponents')
      .select('*')
      .eq('vetting_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching opponents:', { vettingId: id, error });
      return apiError('Failed to fetch opponents', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ opponents: data });
  } catch (err) {
    logger.error('Unhandled error in GET opponents:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canManageOpponents(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = opponentCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const supabase = createServerClient();

    // Verify vetting exists
    const { data: vetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id')
      .eq('id', id)
      .single();

    if (vettingError || !vetting) {
      return apiError('Vetting not found', ApiErrorCode.NOT_FOUND, 404);
    }

    const d = parseResult.data;
    const { data: opponent, error: insertError } = await supabase
      .from('rlc_candidate_vetting_opponents')
      .insert({
        id: crypto.randomUUID(),
        vetting_id: id,
        name: d.name,
        party: d.party ?? null,
        is_incumbent: d.isIncumbent,
        background: d.background ?? null,
        credibility: d.credibility ?? null,
        fundraising: d.fundraising ?? null,
        endorsements: d.endorsements,
        social_links: d.socialLinks ?? null,
        photo_url: d.photoUrl ?? null,
      } as never)
      .select()
      .single();

    if (insertError) {
      logger.error('Error creating opponent:', { vettingId: id, error: insertError });
      return apiError('Failed to create opponent', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ opponent }, { status: 201 });
  } catch (err) {
    logger.error('Unhandled error in POST opponents:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
