import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'active';

  try {
    const supabase = createServerClient();
    const { data: charters, error } = await supabase
      .from('rlc_charters')
      .select('id, name, slug, state_code, region_name, status, website_url, contact_email')
      .eq('status', status)
      .order('name');

    if (error) {
      throw error;
    }

    return NextResponse.json({ charters });
  } catch (error) {
    logger.error('Error fetching charters:', error);
    return apiError('Failed to fetch charters', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
