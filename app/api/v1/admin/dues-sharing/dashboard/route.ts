import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Build base query scoped to visible charters
  let baseQuery = supabase.from('rlc_split_ledger_entries').select('amount, status, recipient_charter_id, created_at');
  if (ctx.visibleCharterIds !== null) {
    baseQuery = baseQuery.in('recipient_charter_id', ctx.visibleCharterIds);
  }

  const { data: entries } = await baseQuery;
  const rows = (entries || []) as { amount: number; status: string; recipient_charter_id: string; created_at: string }[];

  // Calculate KPIs
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let totalDistributed = 0;
  let totalPending = 0;
  let monthlyDistributed = 0;
  const charterTotals = new Map<string, number>();

  for (const row of rows) {
    const amount = Number(row.amount);
    if (amount < 0) continue; // Skip reversals for totals

    if (row.status === 'transferred') {
      totalDistributed += amount;
      if (row.created_at >= thisMonth) {
        monthlyDistributed += amount;
      }
    } else if (row.status === 'pending') {
      totalPending += amount;
    }

    const current = charterTotals.get(row.recipient_charter_id) || 0;
    charterTotals.set(row.recipient_charter_id, current + amount);
  }

  // Get charter names for top recipients
  const topCharterIds = [...charterTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id);

  let topCharters: { id: string; name: string; total: number }[] = [];
  if (topCharterIds.length > 0) {
    const { data: charters } = await supabase
      .from('rlc_charters')
      .select('id, name')
      .in('id', topCharterIds);

    topCharters = (charters || []).map((c: { id: string; name: string }) => ({
      ...c,
      total: charterTotals.get(c.id) || 0,
    })).sort((a: { total: number }, b: { total: number }) => b.total - a.total);
  }

  // Count connected charters
  let accountQuery = supabase.from('rlc_charter_stripe_accounts').select('charter_id, status');
  if (ctx.visibleCharterIds !== null) {
    accountQuery = accountQuery.in('charter_id', ctx.visibleCharterIds);
  }
  const { data: accounts } = await accountQuery;
  const activeAccounts = (accounts || []).filter((a: { status: string }) => a.status === 'active').length;
  const totalAccounts = (accounts || []).length;

  return NextResponse.json({
    totalDistributed,
    totalPending,
    monthlyDistributed,
    activeAccounts,
    totalAccounts,
    topCharters,
    totalEntries: rows.length,
  });
}
