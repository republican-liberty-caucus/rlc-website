import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { getDescendantIds } from '@/lib/admin/report-helpers';
import { logger } from '@/lib/logger';
import type { Charter } from '@/types';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');
  const charterParam = url.searchParams.get('charter');

  const supabase = createServerClient();

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
    }
  }

  // Contribution report with date filtering
  let query = supabase
    .from('rlc_contributions')
    .select(`
      id, amount, contribution_type, payment_status, created_at, is_recurring,
      member:rlc_members(first_name, last_name, email),
      charter:rlc_charters(name)
    `)
    .eq('payment_status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10000);

  if (startParam) {
    query = query.gte('created_at', new Date(startParam).toISOString());
  }
  if (endParam) {
    query = query.lte('created_at', new Date(endParam).toISOString());
  }
  if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
    query = query.in('charter_id', effectiveCharterIds);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Report export failed:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }

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

  const rows = (data || []) as ContributionRow[];

  // Build CSV
  const headers = ['Date', 'Name', 'Email', 'Type', 'Amount', 'Recurring', 'Charter', 'Status'];
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const name = row.member
      ? `${row.member.first_name} ${row.member.last_name}`
      : 'Anonymous';
    const email = row.member?.email || '';
    const line = [
      new Date(row.created_at).toLocaleDateString(),
      `"${name}"`,
      email,
      row.contribution_type,
      Number(row.amount).toFixed(2),
      row.is_recurring ? 'Yes' : 'No',
      row.charter?.name || 'National',
      row.payment_status,
    ].join(',');
    csvLines.push(line);
  }

  const csv = csvLines.join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="rlc-contributions-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
