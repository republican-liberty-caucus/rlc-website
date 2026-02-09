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
  const charterId = searchParams.get('charterId');
  const month = searchParams.get('month'); // YYYY-MM format
  const format = searchParams.get('format') || 'json';

  const supabase = createServerClient();

  let query = supabase
    .from('rlc_split_ledger_entries')
    .select('id, contribution_id, source_type, recipient_charter_id, amount, currency, status, stripe_transfer_id, transferred_at, created_at')
    .order('created_at', { ascending: false });

  // Charter filter
  if (charterId) {
    if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    query = query.eq('recipient_charter_id', charterId);
  } else if (ctx.visibleCharterIds !== null) {
    query = query.in('recipient_charter_id', ctx.visibleCharterIds);
  }

  // Month filter
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM (e.g. 2026-02)' }, { status: 400 });
    }
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
    recipient_charter_id: string;
    amount: number;
    currency: string;
    status: string;
    stripe_transfer_id: string | null;
    transferred_at: string | null;
    created_at: string;
  }[];

  if (format === 'csv') {
    // Escape CSV fields to prevent formula injection and handle special characters
    const escapeCsvField = (value: string | number | null | undefined): string => {
      const str = String(value ?? '');
      // Prefix formula-triggering characters with a single quote
      const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      // Wrap in double quotes and escape internal quotes
      return `"${sanitized.replace(/"/g, '""')}"`;
    };

    const header = '"ID","Contribution ID","Source Type","Recipient Charter","Amount","Currency","Status","Transfer ID","Transferred At","Created At"';
    const csvRows = rows.map((r) =>
      [r.id, r.contribution_id, r.source_type, r.recipient_charter_id, r.amount, r.currency, r.status, r.stripe_transfer_id || '', r.transferred_at || '', r.created_at]
        .map(escapeCsvField)
        .join(',')
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
