import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageCommittee } from '@/lib/vetting/permissions';
import { committeeMemberUpdateSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageCommittee(ctx)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { memberId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = committeeMemberUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.role !== undefined) updates.role = parseResult.data.role;
  if (parseResult.data.isActive !== undefined) updates.is_active = parseResult.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_vetting_committee_members')
    .update(updates as never)
    .eq('id', memberId)
    .select('*, contact:rlc_members(id, first_name, last_name, email)')
    .single();

  if (error) {
    logger.error('Error updating committee member:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageCommittee(ctx)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { memberId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from('rlc_candidate_vetting_committee_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    logger.error('Error removing committee member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
