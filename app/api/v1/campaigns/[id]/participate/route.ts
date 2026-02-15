import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { participationCreateSchema } from '@/lib/validations/campaign';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const parseResult = participationCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;
  const { id } = await params;
  const supabase = createServerClient();

  // Verify campaign exists and is active
  const { data: campaign, error: campaignError } = await supabase
    .from('rlc_action_campaigns')
    .select('id, status')
    .eq('id', id)
    .single();

  if (campaignError || !campaign) {
    return apiError('Campaign not found', ApiErrorCode.NOT_FOUND, 404);
  }

  const campaignRow = campaign as { id: string; status: string };
  if (campaignRow.status !== 'active') {
    return apiError('Campaign is not active', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const { data, error } = await supabase
    .from('rlc_campaign_participations')
    .insert({
      id: crypto.randomUUID(),
      campaign_id: id,
      contact_id: member.id,
      action: input.action,
      legislator_id: input.legislatorId || null,
      metadata: input.metadata || {},
    } as never)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return apiError('Already participated with this action', ApiErrorCode.CONFLICT, 409);
    }
    logger.error('Error logging participation:', error);
    return apiError('Failed to log participation', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ participation: data }, { status: 201 });
}
