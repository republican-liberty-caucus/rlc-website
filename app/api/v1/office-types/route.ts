import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

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
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { data: rawCharter, error: charterError } = await supabase
      .from('rlc_charters')
      .select('charter_level')
      .eq('id', charterId)
      .single();

    if (charterError || !rawCharter) {
      return apiError('Charter not found', ApiErrorCode.NOT_FOUND, 404);
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
    return apiError('Failed to fetch office types', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ officeTypes: data });
}
