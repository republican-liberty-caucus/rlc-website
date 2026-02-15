import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getAdminContext(userId);
    if (!ctx) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerClient();

    let query = supabase
      .from('rlc_share_kits')
      .select('*')
      .order('created_at', { ascending: false });

    if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
      query = query.or(`charter_id.in.(${ctx.visibleCharterIds.join(',')}),scope.eq.national`);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch share kits:', { error, userId });
      return NextResponse.json({ error: 'Failed to fetch share kits' }, { status: 500 });
    }

    return NextResponse.json({ shareKits: data });
  } catch (err) {
    logger.error('Unhandled error in share-kits GET:', { error: err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
