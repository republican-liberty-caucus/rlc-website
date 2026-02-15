import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { supabase } = result;

  const { searchParams } = request.nextUrl;
  const stateCode = searchParams.get('stateCode');
  const cycleYear = searchParams.get('cycleYear');
  const officeType = searchParams.get('officeType');

  if (!stateCode || !cycleYear) {
    return apiError('stateCode and cycleYear query parameters are required', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  let query = supabase
    .from('rlc_candidate_election_deadlines')
    .select('*')
    .eq('state_code', stateCode.toUpperCase())
    .eq('cycle_year', parseInt(cycleYear, 10));

  if (officeType) {
    query = query.eq('office_type', officeType);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    logger.error('Error looking up election deadline:', error);
    return apiError('Failed to lookup deadline', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ deadline: data });
}
