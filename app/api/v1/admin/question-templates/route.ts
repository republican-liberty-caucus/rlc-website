import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { supabase } = result;

  const { searchParams } = request.nextUrl;
  const officeLevel = searchParams.get('officeLevel');
  const category = searchParams.get('category');
  const active = searchParams.get('active') !== 'false'; // default true

  if (!officeLevel) {
    return apiError('officeLevel query parameter is required', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  let query = supabase
    .from('rlc_question_templates')
    .select('*')
    .contains('office_levels', [officeLevel])
    .eq('is_active', active)
    .order('sort_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching question templates:', error);
    return apiError('Failed to fetch templates', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ templates: data || [] });
}
