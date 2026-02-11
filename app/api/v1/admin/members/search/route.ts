import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, sanitizeSearch } from '@/lib/admin/permissions';

/**
 * GET /api/v1/admin/members/search?q=smith&charter_id=xxx
 * Lightweight member search for dropdowns (returns id + name only).
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q') || '';
  const charterId = searchParams.get('charter_id');

  if (query.length < 2) {
    return NextResponse.json({ members: [] });
  }

  const safe = sanitizeSearch(query);
  const supabase = createServerClient();

  let q = supabase
    .from('rlc_members')
    .select('id, first_name, last_name')
    .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`)
    .order('last_name')
    .limit(25);

  if (charterId) {
    q = q.eq('primary_charter_id', charterId);
  }

  // Scope to visible charters for non-national admins
  if (!charterId && ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    q = q.in('primary_charter_id', ctx.visibleCharterIds);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({
    members: (data || []).map((m: { id: string; first_name: string; last_name: string }) => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
    })),
  });
}
