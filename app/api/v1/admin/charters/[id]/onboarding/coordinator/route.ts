import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

const schema = z.object({
  coordinatorId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!ctx.isNational) {
    return apiError('Forbidden: national admin required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: charterId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const { coordinatorId } = parseResult.data;

  // Verify member exists
  const { data: member, error: memberError } = await supabase
    .from('rlc_contacts')
    .select('id')
    .eq('id', coordinatorId)
    .single();

  if (memberError || !member) {
    if (memberError && memberError.code !== 'PGRST116') {
      logger.error('Error looking up coordinator member:', memberError);
      return apiError('Failed to verify member', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .update({ coordinator_id: coordinatorId })
    .eq('charter_id', charterId)
    .select()
    .single();

  if (error || !data) {
    if (!error || error.code === 'PGRST116') {
      return apiError('No onboarding found for this charter', ApiErrorCode.NOT_FOUND, 404);
    }
    logger.error('Error updating coordinator:', error);
    return apiError('Failed to update coordinator', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ onboarding: data });
}
