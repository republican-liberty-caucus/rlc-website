import { getDescendantIds } from '@/lib/admin/report-helpers';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { escapeCsvField } from '@/lib/csv';
import { logger } from '@/lib/logger';
import type { Charter } from '@/types';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function GET(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const url = new URL(request.url);
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');
  const charterParam = url.searchParams.get('charter');

  // Compute effective charter IDs when charter filter is applied
  let effectiveCharterIds = ctx.visibleCharterIds;
  if (charterParam) {
    const { data: allCharters } = await supabase
      .from('rlc_charters')
      .select('id, parent_charter_id');
    const charters = (allCharters || []) as Pick<Charter, 'id' | 'parent_charter_id'>[];
    const descendants = getDescendantIds(charterParam, charters);
    if (ctx.visibleCharterIds === null) {
      effectiveCharterIds = descendants;
    } else {
      const visibleSet = new Set(ctx.visibleCharterIds);
      effectiveCharterIds = descendants.filter((id) => visibleSet.has(id));
      // If intersection is empty, the charter is outside this user's scope — fall back to their full visible set
      if (effectiveCharterIds.length === 0) {
        effectiveCharterIds = ctx.visibleCharterIds;
      }
    }
  }

  // Contribution report with date filtering
  type ContributionRow = {
    id: string;
    amount: number;
    contribution_type: string;
    payment_status: string;
    created_at: string;
    is_recurring: boolean;
    member: { first_name: string; last_name: string; email: string } | null;
    charter: { name: string } | null;
  };

  let query = supabase
    .from('rlc_contributions')
    .select(`
      id, amount, contribution_type, payment_status, created_at, is_recurring,
      member:rlc_contacts(first_name, last_name, email),
      charter:rlc_charters(name)
    `)
    .eq('payment_status', 'completed')
    .order('created_at', { ascending: false });

  if (startParam) {
    query = query.gte('created_at', new Date(startParam).toISOString());
  }
  if (endParam) {
    query = query.lte('created_at', new Date(endParam).toISOString());
  }
  if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
    query = query.in('charter_id', effectiveCharterIds);
  }

  // Fetch all rows via pagination (PostgREST default is 1000 per request)
  const PAGE_SIZE = 1000;
  const rows: ContributionRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      logger.error('Report export failed:', error);
      return apiError('Export failed', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    if (!data?.length) break;
    rows.push(...(data as ContributionRow[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Build CSV
  const headers = ['Date', 'Name', 'Email', 'Type', 'Amount', 'Recurring', 'Charter', 'Status'];
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const name = row.member
      ? `${row.member.first_name} ${row.member.last_name}`
      : 'Anonymous';
    const email = row.member?.email || '';
    const fields = [
      new Date(row.created_at).toLocaleDateString(),
      name,
      email,
      row.contribution_type,
      Number(row.amount).toFixed(2),
      row.is_recurring ? 'Yes' : 'No',
      row.charter?.name || 'National',
      row.payment_status,
    ];
    csvLines.push(fields.map(escapeCsvField).join(','));
  }

  // Prepend UTF-8 BOM for Excel compatibility
  const csv = '\uFEFF' + csvLines.join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rlc-contributions-${new Date().toISOString().split('T')[0]}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
