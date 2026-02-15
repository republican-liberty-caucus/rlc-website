import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageDeadlines } from '@/lib/vetting/permissions';
import { electionDeadlineUpdateSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageDeadlines(ctx)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = electionDeadlineUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;
  const updates: Record<string, unknown> = {};
  if (input.stateCode !== undefined) updates.state_code = input.stateCode;
  if (input.cycleYear !== undefined) updates.cycle_year = input.cycleYear;
  if (input.officeType !== undefined) updates.office_type = input.officeType;
  if (input.primaryDate !== undefined) updates.primary_date = input.primaryDate;
  if (input.primaryRunoffDate !== undefined) updates.primary_runoff_date = input.primaryRunoffDate;
  if (input.generalDate !== undefined) updates.general_date = input.generalDate;
  if (input.generalRunoffDate !== undefined) updates.general_runoff_date = input.generalRunoffDate;
  if (input.filingDeadline !== undefined) updates.filing_deadline = input.filingDeadline;
  if (input.notes !== undefined) updates.notes = input.notes;

  if (Object.keys(updates).length === 0) {
    return apiError('No fields to update', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_election_deadlines')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return apiError('A deadline for this state/year/office already exists', ApiErrorCode.CONFLICT, 409);
    }
    logger.error('Error updating election deadline:', error);
    return apiError('Failed to update deadline', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ deadline: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageDeadlines(ctx)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from('rlc_candidate_election_deadlines')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting election deadline:', error);
    return apiError('Failed to delete deadline', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ success: true });
}
