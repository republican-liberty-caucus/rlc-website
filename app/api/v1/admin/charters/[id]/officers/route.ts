import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, canManageRoles } from '@/lib/admin/permissions';
import { assignOfficerPositionSchema } from '@/lib/validations/officer-position';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: charterId } = await params;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_officer_positions')
    .select(`
      id, title, committee_name, started_at, ended_at, is_active, notes, created_at,
      member:rlc_members!rlc_officer_positions_member_id_fkey(id, first_name, last_name, email),
      appointed_by:rlc_members!rlc_officer_positions_appointed_by_id_fkey(first_name, last_name)
    `)
    .eq('charter_id', charterId)
    .order('is_active', { ascending: false })
    .order('started_at', { ascending: false });

  if (error) {
    logger.error('Error fetching officers:', error);
    return NextResponse.json({ error: 'Failed to fetch officers' }, { status: 500 });
  }

  return NextResponse.json({ officers: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx || !canManageRoles(ctx)) {
    return NextResponse.json({ error: 'Forbidden: national_board+ required' }, { status: 403 });
  }

  const { id: charterId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = assignOfficerPositionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { memberId, title, committeeName, startedAt, notes } = parseResult.data;

  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_officer_positions')
    .insert({
      member_id: memberId,
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
      return NextResponse.json({ error: 'This position is already assigned' }, { status: 409 });
    }
    logger.error('Error assigning officer:', error);
    return NextResponse.json({ error: 'Failed to assign officer' }, { status: 500 });
  }

  return NextResponse.json({ position: data }, { status: 201 });
}
