import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function GET() {
  try {
    const result = await requireAdminApi();
    if (result.error) return result.error;
    const { ctx, supabase } = result;

    let query = supabase
      .from('rlc_share_kits')
      .select('*')
      .order('created_at', { ascending: false });

    if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
      query = query.or(`charter_id.in.(${ctx.visibleCharterIds.join(',')}),scope.eq.national`);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch share kits:', { error, memberId: ctx.member.id });
      return apiError('Failed to fetch share kits', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ shareKits: data });
  } catch (err) {
    logger.error('Unhandled error in share-kits GET:', { error: err });
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
