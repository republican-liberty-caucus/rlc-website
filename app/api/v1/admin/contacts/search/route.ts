import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch } from '@/lib/admin/permissions';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const raw = request.nextUrl.searchParams.get('q')?.trim();
  if (!raw || raw.length < 2) {
    return NextResponse.json({ contacts: [] });
  }
  const safe = sanitizeSearch(raw);

  let q = supabase
    .from('rlc_contacts')
    .select('id, first_name, last_name, email')
    .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`)
    .order('last_name')
    .limit(10);

  // Scope to visible charters for non-national admins
  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    q = q.in('primary_charter_id', ctx.visibleCharterIds);
  }

  const { data, error } = await q;

  if (error) {
    return apiError('Search failed', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ contacts: data });
}
