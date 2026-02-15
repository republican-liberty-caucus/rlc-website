import { NextResponse } from 'next/server';
import { canViewMember } from '@/lib/admin/permissions';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id: memberId } = await params;

  // Check member exists and is visible
  const { data: memberRaw, error: memberError } = await supabase
    .from('rlc_contacts')
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
    .from('rlc_organizational_positions')
    .select(`
      id, title, committee_name, started_at, ended_at, is_active, notes, created_at,
      charter:rlc_charters(id, name),
      appointed_by:rlc_contacts!rlc_organizational_positions_appointed_by_id_fkey(first_name, last_name)
    `)
    .eq('contact_id', memberId)
    .order('is_active', { ascending: false })
    .order('started_at', { ascending: false });

  if (error) {
    logger.error('Error fetching member positions:', error);
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }

  return NextResponse.json({ positions: data });
}
