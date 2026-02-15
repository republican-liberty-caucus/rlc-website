import { NextResponse } from 'next/server';
import { canManageRoles } from '@/lib/admin/permissions';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { assignOfficerPositionSchema } from '@/lib/validations/officer-position';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id: charterId } = await params;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_organizational_positions')
    .select(`
      id, title, committee_name, started_at, ended_at, is_active, notes, created_at,
      member:rlc_contacts!rlc_organizational_positions_contact_id_fkey(id, first_name, last_name, email),
      appointed_by:rlc_contacts!rlc_organizational_positions_appointed_by_id_fkey(first_name, last_name)
    `)
    .eq('charter_id', charterId)
    .order('is_active', { ascending: false })
    .order('started_at', { ascending: false });

  if (error) {
    logger.error('Error fetching officers:', error);
    return apiError('Failed to fetch officers', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ officers: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!canManageRoles(ctx)) {
    return apiError('Forbidden: national_board+ required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: charterId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = assignOfficerPositionSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const { memberId, title, committeeName, startedAt, notes } = parseResult.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_organizational_positions')
    .insert({
      contact_id: memberId,
      charter_id: charterId,
      title,
      committee_name: committeeName || null,
      started_at: startedAt || new Date().toISOString(),
      appointed_by_id: ctx.member.id,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return apiError('This position is already assigned', ApiErrorCode.CONFLICT, 409);
    }
    logger.error('Error assigning officer:', error);
    return apiError(`Failed to assign officer: ${error.message || error.code || 'unknown error'}`, ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ position: data }, { status: 201 });
}
