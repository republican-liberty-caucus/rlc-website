import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, canManageRoles } from '@/lib/admin/permissions';
import { updateOfficerPositionSchema } from '@/lib/validations/officer-position';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; positionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx || !canManageRoles(ctx)) {
    return NextResponse.json({ error: 'Forbidden: national_board+ required' }, { status: 403 });
  }

  const { id: chapterId, positionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = updateOfficerPositionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Verify position belongs to this chapter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findError } = await (supabase as any)
    .from('rlc_officer_positions')
    .select('id')
    .eq('id', positionId)
    .eq('chapter_id', chapterId)
    .single();

  if (findError || !existing) {
    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error looking up officer position:', findError);
      return NextResponse.json({ error: 'Failed to verify position' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Position not found' }, { status: 404 });
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
    .from('rlc_officer_positions')
    .update(updates)
    .eq('id', positionId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating officer position:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }

  return NextResponse.json({ position: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; positionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx || !canManageRoles(ctx)) {
    return NextResponse.json({ error: 'Forbidden: national_board+ required' }, { status: 403 });
  }

  const { id: chapterId, positionId } = await params;
  const supabase = createServerClient();

  // Verify position exists before deleting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findError } = await (supabase as any)
    .from('rlc_officer_positions')
    .select('id')
    .eq('id', positionId)
    .eq('chapter_id', chapterId)
    .single();

  if (findError || !existing) {
    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error looking up officer position for delete:', findError);
      return NextResponse.json({ error: 'Failed to verify position' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Position not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('rlc_officer_positions')
    .delete()
    .eq('id', positionId)
    .eq('chapter_id', chapterId);

  if (error) {
    logger.error('Error deleting officer position:', error);
    return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
