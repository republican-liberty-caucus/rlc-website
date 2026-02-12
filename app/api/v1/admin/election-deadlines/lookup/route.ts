import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const stateCode = searchParams.get('stateCode');
  const cycleYear = searchParams.get('cycleYear');
  const officeType = searchParams.get('officeType');

  if (!stateCode || !cycleYear) {
    return NextResponse.json(
      { error: 'stateCode and cycleYear query parameters are required' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

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
    return NextResponse.json({ error: 'Failed to lookup deadline' }, { status: 500 });
  }

  return NextResponse.json({ deadline: data });
}
