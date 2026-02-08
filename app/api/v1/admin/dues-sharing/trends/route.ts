import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get('months') || '12', 10);
  const chapterId = searchParams.get('chapterId');

  if (chapterId && ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Get entries for the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  let query = supabase
    .from('rlc_split_ledger_entries')
    .select('amount, status, recipient_chapter_id, created_at')
    .gte('created_at', startDate.toISOString())
    .gt('amount', 0); // Exclude reversals

  if (chapterId) {
    query = query.eq('recipient_chapter_id', chapterId);
  } else if (ctx.visibleChapterIds !== null) {
    query = query.in('recipient_chapter_id', ctx.visibleChapterIds);
  }

  const { data: entries } = await query;
  const rows = (entries || []) as { amount: number; status: string; recipient_chapter_id: string; created_at: string }[];

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
