import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/office-types
 *
 * Query params:
 *   charterId - Look up charter's level, return office types matching that endorsing level
 *   level     - Filter by OfficeLevel directly (federal, state, county, etc.)
 *   active    - Filter by is_active (default: true)
 *
 * Returns all matching office types sorted by sort_order.
 */
export async function GET(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { searchParams } = new URL(request.url);
  const charterId = searchParams.get('charterId');
  const level = searchParams.get('level');
  const active = searchParams.get('active') !== 'false'; // default true

  // If charterId provided, look up the charter's level to filter office types
  let endorsingCharterLevel: string | null = null;
  if (charterId) {
    // Scoped admins can only look up charters they have access to
    if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: rawCharter, error: charterError } = await supabase
      .from('rlc_charters')
      .select('charter_level')
      .eq('id', charterId)
      .single();

    if (charterError || !rawCharter) {
      return NextResponse.json({ error: 'Charter not found' }, { status: 404 });
    }

    const charter = rawCharter as unknown as { charter_level: string };
    endorsingCharterLevel = charter.charter_level;
  }

  let query = supabase
    .from('rlc_office_types')
    .select('*')
    .order('sort_order', { ascending: true });

  if (endorsingCharterLevel) {
    query = query.eq('endorsing_charter_level', endorsingCharterLevel);
  }

  if (level) {
    query = query.eq('level', level);
  }

  if (active) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching office types:', error);
    return NextResponse.json({ error: 'Failed to fetch office types' }, { status: 500 });
  }

  return NextResponse.json({ officeTypes: data });
}
