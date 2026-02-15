import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function GET(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { searchParams } = new URL(request.url);
  const rawMonths = parseInt(searchParams.get('months') || '12', 10);
  const months = Number.isNaN(rawMonths) ? 12 : Math.max(1, Math.min(rawMonths, 60));
  const charterId = searchParams.get('charterId');

  if (charterId && ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  // Get entries for the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  let query = supabase
    .from('rlc_split_ledger_entries')
    .select('amount, status, recipient_charter_id, created_at')
    .gte('created_at', startDate.toISOString())
    .gt('amount', 0); // Exclude reversals

  if (charterId) {
    query = query.eq('recipient_charter_id', charterId);
  } else if (ctx.visibleCharterIds !== null) {
    query = query.in('recipient_charter_id', ctx.visibleCharterIds);
  }

  const { data: entries } = await query;
  const rows = (entries || []) as { amount: number; status: string; recipient_charter_id: string; created_at: string }[];

  // Aggregate by month
  const monthlyData = new Map<string, { transferred: number; pending: number; count: number }>();

  for (const row of rows) {
    const date = new Date(row.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const current = monthlyData.get(monthKey) || { transferred: 0, pending: 0, count: 0 };
    const amount = Number(row.amount);

    if (row.status === 'transferred') {
      current.transferred += amount;
    } else if (row.status === 'pending') {
      current.pending += amount;
    }
    current.count += 1;

    monthlyData.set(monthKey, current);
  }

  // Convert to sorted array
  const trends = [...monthlyData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  return NextResponse.json({ trends });
}
