import { NextResponse } from 'next/server';
import { searchBills, getBillDetail } from '@/lib/legiscan/client';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';

export async function GET(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const state = searchParams.get('state') || undefined;
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
  const billId = searchParams.get('billId');

  if (billId) {
    try {
      const bill = await getBillDetail(Number(billId));
      return NextResponse.json({ bill });
    } catch (err) {
      logger.error('LegiScan bill detail error:', err);
      return NextResponse.json({ error: 'Failed to fetch bill details' }, { status: 500 });
    }
  }

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const results = await searchBills(query, { state, year });
    return NextResponse.json({ results });
  } catch (err) {
    logger.error('LegiScan search error:', err);
    return NextResponse.json({ error: 'Failed to search LegiScan' }, { status: 500 });
  }
}
