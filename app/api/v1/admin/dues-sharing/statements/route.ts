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
  const month = searchParams.get('month'); // YYYY-MM format
  const format = searchParams.get('format') || 'json';

  const supabase = createServerClient();

  let query = supabase
    .from('rlc_split_ledger_entries')
    .select('id, contribution_id, source_type, recipient_chapter_id, amount, currency, status, stripe_transfer_id, transferred_at, created_at')
    .order('created_at', { ascending: false });

  // Chapter filter
  if (chapterId) {
    if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    query = query.eq('recipient_chapter_id', chapterId);
  } else if (ctx.visibleChapterIds !== null) {
    query = query.in('recipient_chapter_id', ctx.visibleChapterIds);
  }

  // Month filter
  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString();
    const endDate = new Date(year, m, 1).toISOString();
    query = query.gte('created_at', startDate).lt('created_at', endDate);
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  const rows = (entries || []) as {
    id: string;
    contribution_id: string;
    source_type: string;
    recipient_chapter_id: string;
    amount: number;
    currency: string;
    status: string;
    stripe_transfer_id: string | null;
    transferred_at: string | null;
    created_at: string;
  }[];

  if (format === 'csv') {
    const header = 'ID,Contribution ID,Source Type,Recipient Chapter,Amount,Currency,Status,Transfer ID,Transferred At,Created At';
    const csvRows = rows.map((r) =>
      `${r.id},${r.contribution_id},${r.source_type},${r.recipient_chapter_id},${r.amount},${r.currency},${r.status},${r.stripe_transfer_id || ''},${r.transferred_at || ''},${r.created_at}`
    );

    return new Response([header, ...csvRows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="dues-statement-${month || 'all'}.csv"`,
      },
    });
  }

  // Calculate summary
  const summary = {
    totalTransferred: rows.filter((r) => r.status === 'transferred' && Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0),
    totalPending: rows.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0),
    totalReversed: rows.filter((r) => r.status === 'reversed' && Number(r.amount) < 0).reduce((s, r) => s + Math.abs(Number(r.amount)), 0),
    entryCount: rows.length,
  };

  return NextResponse.json({ entries: rows, summary });
}
