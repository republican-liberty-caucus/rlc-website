import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const upcoming = searchParams.get('upcoming') !== 'false';
  const charterId = searchParams.get('charter_id');

  try {
    const supabase = createServerClient();

    let query = supabase
      .from('rlc_events')
      .select(`
        id, title, slug, description, event_type,
        start_date, end_date, timezone,
        is_virtual, location_name, address, city, state, postal_code, virtual_url,
        registration_required, max_attendees, registration_fee, registration_deadline,
        charter:rlc_charters(id, name, slug),
        status
      `)
      .eq('status', 'published')
      .order('start_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (upcoming) {
      query = query.gte('start_date', new Date().toISOString());
    }

    if (charterId) {
      query = query.eq('charter_id', charterId);
    }

    const { data: events, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ events });
  } catch (error) {
    logger.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
