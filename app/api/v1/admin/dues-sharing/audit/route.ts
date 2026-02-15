import { NextResponse } from 'next/server';
import { rpc } from '@/lib/supabase/rpc';
import { requireAdminApi } from '@/lib/admin/route-helpers';

export async function GET(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = (page - 1) * limit;
  const charterId = searchParams.get('charterId');
  const status = searchParams.get('status');
  const contributionId = searchParams.get('contributionId');

  if (charterId && ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build the charter_ids filter for RPC
  const charterIds = charterId
    ? [charterId]
    : ctx.visibleCharterIds;

  // Fetch page of data and accurate count in parallel
  let dataQuery = supabase
    .from('rlc_split_ledger_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filters on data query
  if (charterId) {
    dataQuery = dataQuery.eq('recipient_charter_id', charterId);
  } else if (ctx.visibleCharterIds !== null) {
    dataQuery = dataQuery.in('recipient_charter_id', ctx.visibleCharterIds);
  }

  if (status) {
    dataQuery = dataQuery.eq('status', status);
  }

  if (contributionId) {
    dataQuery = dataQuery.eq('contribution_id', contributionId);
  }

  const [dataRes, countRes] = await Promise.all([
    dataQuery,
    rpc(supabase, 'get_ledger_entry_count', {
      p_charter_ids: charterIds,
      p_status: status || null,
      p_contribution_id: contributionId || null,
    }),
  ]);

  if (dataRes.error) {
    return NextResponse.json({ error: 'Failed to fetch audit trail' }, { status: 500 });
  }

  const entries = dataRes.data;
  const count = countRes.data as number ?? 0;

  // Enrich with charter names
  const rows = (entries || []) as Record<string, unknown>[];
  const enrichCharterIds = [...new Set(rows.map((r) => r.recipient_charter_id as string))];

  let charterNameMap = new Map<string, string>();
  if (enrichCharterIds.length > 0) {
    const { data: charters } = await supabase
      .from('rlc_charters')
      .select('id, name')
      .in('id', enrichCharterIds);

    charterNameMap = new Map((charters || []).map((c: { id: string; name: string }) => [c.id, c.name]));
  }

  const enriched = rows.map((r) => ({
    ...r,
    charter_name: charterNameMap.get(r.recipient_charter_id as string) || 'Unknown',
  }));

  return NextResponse.json({
    data: enriched,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
