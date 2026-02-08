import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'active';

  try {
    const supabase = createServerClient();
    const { data: chapters, error } = await supabase
      .from('rlc_chapters')
      .select('id, name, slug, state_code, region, status, website_url, contact_email')
      .eq('status', status)
      .order('name');

    if (error) {
      throw error;
    }

    return NextResponse.json({ chapters });
  } catch (error) {
    logger.error('Error fetching chapters:', error);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}
