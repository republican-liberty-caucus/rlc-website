import { NextResponse } from 'next/server';
import { canManageRoles } from '@/lib/admin/permissions';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { updateOfficerPositionSchema } from '@/lib/validations/officer-position';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; positionId: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!canManageRoles(ctx)) {
    return apiError('Forbidden: national_board+ required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: charterId, positionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = updateOfficerPositionSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  // Verify position belongs to this charter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findError } = await (supabase as any)
    .from('rlc_organizational_positions')
    .select('id')
    .eq('id', positionId)
    .eq('charter_id', charterId)
    .single();

  if (findError || !existing) {
    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error looking up officer position:', findError);
      return apiError('Failed to verify position', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('Position not found', ApiErrorCode.NOT_FOUND, 404);
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.endedAt !== undefined) updates.ended_at = parseResult.data.endedAt;
  if (parseResult.data.isActive !== undefined) updates.is_active = parseResult.data.isActive;
  if (parseResult.data.notes !== undefined) updates.notes = parseResult.data.notes;

  // If ending a position, also mark it inactive
  if (updates.ended_at && parseResult.data.isActive === undefined) {
    updates.is_active = false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_organizational_positions')
    .update(updates)
    .eq('id', positionId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating officer position:', error);
    return apiError('Failed to update position', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ position: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; positionId: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!canManageRoles(ctx)) {
    return apiError('Forbidden: national_board+ required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: charterId, positionId } = await params;

  // Verify position exists before deleting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findError } = await (supabase as any)
    .from('rlc_organizational_positions')
    .select('id')
    .eq('id', positionId)
    .eq('charter_id', charterId)
    .single();

  if (findError || !existing) {
    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error looking up officer position for delete:', findError);
      return apiError('Failed to verify position', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('Position not found', ApiErrorCode.NOT_FOUND, 404);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('rlc_organizational_positions')
    .delete()
    .eq('id', positionId)
    .eq('charter_id', charterId);

  if (error) {
    logger.error('Error deleting officer position:', error);
    return apiError('Failed to delete position', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ success: true });
}
