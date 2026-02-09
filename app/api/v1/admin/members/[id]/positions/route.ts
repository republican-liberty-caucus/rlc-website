import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, canViewMember } from '@/lib/admin/permissions';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: memberId } = await params;
  const supabase = createServerClient();

  // Check member exists and is visible
  const { data: memberRaw, error: memberError } = await supabase
    .from('rlc_members')
    .select('id, primary_charter_id')
    .eq('id', memberId)
    .single();

  if (memberError || !memberRaw) {
    if (memberError && memberError.code !== 'PGRST116') {
      logger.error('Error looking up member for positions:', memberError);
      return NextResponse.json({ error: 'Failed to verify member' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const member = memberRaw as { id: string; primary_charter_id: string | null };

  if (!canViewMember(ctx, member.primary_charter_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_officer_positions')
    .select(`
      id, title, committee_name, started_at, ended_at, is_active, notes, created_at,
      charter:rlc_charters(id, name),
      appointed_by:rlc_members!rlc_officer_positions_appointed_by_id_fkey(first_name, last_name)
    `)
    .eq('member_id', memberId)
    .order('is_active', { ascending: false })
    .order('started_at', { ascending: false });

  if (error) {
    logger.error('Error fetching member positions:', error);
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }

  return NextResponse.json({ positions: data });
}
