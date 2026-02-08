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

  // Build base query scoped to visible chapters
  let baseQuery = supabase.from('rlc_split_ledger_entries').select('amount, status, recipient_chapter_id, created_at');
  if (ctx.visibleChapterIds !== null) {
    baseQuery = baseQuery.in('recipient_chapter_id', ctx.visibleChapterIds);
  }

  const { data: entries } = await baseQuery;
  const rows = (entries || []) as { amount: number; status: string; recipient_chapter_id: string; created_at: string }[];

  // Calculate KPIs
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let totalDistributed = 0;
  let totalPending = 0;
  let monthlyDistributed = 0;
  const chapterTotals = new Map<string, number>();

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

    const current = chapterTotals.get(row.recipient_chapter_id) || 0;
    chapterTotals.set(row.recipient_chapter_id, current + amount);
  }

  // Get chapter names for top recipients
  const topChapterIds = [...chapterTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id);

  let topChapters: { id: string; name: string; total: number }[] = [];
  if (topChapterIds.length > 0) {
    const { data: chapters } = await supabase
      .from('rlc_chapters')
      .select('id, name')
      .in('id', topChapterIds);

    topChapters = (chapters || []).map((c: { id: string; name: string }) => ({
      ...c,
      total: chapterTotals.get(c.id) || 0,
    })).sort((a: { total: number }, b: { total: number }) => b.total - a.total);
  }

  // Count connected chapters
  let accountQuery = supabase.from('rlc_chapter_stripe_accounts').select('chapter_id, status');
  if (ctx.visibleChapterIds !== null) {
    accountQuery = accountQuery.in('chapter_id', ctx.visibleChapterIds);
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
    topChapters,
    totalEntries: rows.length,
  });
}
