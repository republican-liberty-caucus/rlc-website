import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, applyMemberFilters } from '@/lib/admin/permissions';
import { escapeCsvField } from '@/lib/csv';
import { formatDate } from '@/lib/utils';
import type { MembershipTier, MembershipStatus } from '@/types';
import { logger } from '@/lib/logger';

interface ExportRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  membership_tier: MembershipTier;
  membership_status: MembershipStatus;
  membership_join_date: string | null;
  membership_expiry_date: string | null;
  primary_charter: { name: string } | null;
}

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
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const tier = searchParams.get('tier');
  const source = searchParams.get('source');
  const joined_after = searchParams.get('joined_after');
  const joined_before = searchParams.get('joined_before');

  const supabase = createServerClient();

  let query = supabase
    .from('rlc_contacts')
    .select(`
      first_name, last_name, email, phone,
      city, state, membership_tier, membership_status,
      membership_join_date, membership_expiry_date,
      primary_charter:rlc_charters(name)
    `)
    .order('last_name')
    .limit(10000);

  query = applyMemberFilters(query, ctx.visibleCharterIds, { search, status, tier, source, joined_after, joined_before });

  const { data, error } = await query;

  if (error) {
    logger.error('Export query error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }

  const rows = (data || []) as ExportRow[];

  const headers = ['Name', 'Email', 'Phone', 'City', 'State', 'Tier', 'Status', 'Charter', 'Join Date', 'Expiry Date'];
  const csvLines = [
    headers.join(','),
    ...rows.map((row) => {
      const fields = [
        `${row.first_name} ${row.last_name}`,
        row.email,
        row.phone || '',
        row.city || '',
        row.state || '',
        row.membership_tier,
        row.membership_status,
        row.primary_charter?.name || '',
        row.membership_join_date ? formatDate(row.membership_join_date) : '',
        row.membership_expiry_date ? formatDate(row.membership_expiry_date) : '',
      ];
      return fields.map(escapeCsvField).join(',');
    }),
  ];

  // Prepend UTF-8 BOM for Excel compatibility
  const csv = '\uFEFF' + csvLines.join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rlc-members-${new Date().toISOString().split('T')[0]}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
