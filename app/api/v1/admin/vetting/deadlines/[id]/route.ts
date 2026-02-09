import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageDeadlines } from '@/lib/vetting/permissions';
import { electionDeadlineUpdateSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageDeadlines(ctx)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = electionDeadlineUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
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
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
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
      return NextResponse.json(
        { error: 'A deadline for this state/year/office already exists' },
        { status: 409 }
      );
    }
    logger.error('Error updating election deadline:', error);
    return NextResponse.json({ error: 'Failed to update deadline' }, { status: 500 });
  }

  return NextResponse.json({ deadline: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageDeadlines(ctx)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from('rlc_candidate_election_deadlines')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting election deadline:', error);
    return NextResponse.json({ error: 'Failed to delete deadline' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
