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
  const chapterId = searchParams.get('chapterId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;

  const supabase = createServerClient();

  // Get contributions with splits, joined to members
  let query = supabase
    .from('rlc_contributions')
    .select(`
      id, member_id, amount, contribution_type, payment_status, created_at,
      rlc_members!inner(id, first_name, last_name, email, primary_chapter_id)
    `, { count: 'exact' })
    .eq('contribution_type', 'membership')
    .eq('payment_status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filter by chapter
  if (chapterId) {
    if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    query = query.eq('chapter_id', chapterId);
  } else if (ctx.visibleChapterIds !== null) {
    query = query.in('chapter_id', ctx.visibleChapterIds);
  }

  const { data: contributions, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch member dues' }, { status: 500 });
  }

  // For each contribution, get its ledger entries
  const contributionIds = (contributions || []).map((c: { id: string }) => c.id);
  let ledgerEntries: Record<string, unknown>[] = [];

  if (contributionIds.length > 0) {
    const { data: entries } = await supabase
      .from('rlc_split_ledger_entries')
      .select('contribution_id, recipient_chapter_id, amount, status')
      .in('contribution_id', contributionIds);

    ledgerEntries = (entries || []) as Record<string, unknown>[];
  }

  // Group ledger entries by contribution
  const ledgerByContribution = new Map<string, Record<string, unknown>[]>();
  for (const entry of ledgerEntries) {
    const cId = entry.contribution_id as string;
    const list = ledgerByContribution.get(cId) || [];
    list.push(entry);
    ledgerByContribution.set(cId, list);
  }

  const result = (contributions || []).map((c: Record<string, unknown>) => ({
    ...c,
    splits: ledgerByContribution.get(c.id as string) || [],
  }));

  return NextResponse.json({
    data: result,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
