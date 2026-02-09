import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: charterId } = await params;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_charter_stripe_accounts')
    .select('id, stripe_account_id, status, charges_enabled, payouts_enabled, onboarding_completed_at, created_at')
    .eq('charter_id', charterId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found — charter hasn't started onboarding
      return NextResponse.json({
        status: 'not_started',
        charges_enabled: false,
        payouts_enabled: false,
      });
    }
    return NextResponse.json({ error: 'Failed to fetch Stripe account status' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({
      status: 'not_started',
      charges_enabled: false,
      payouts_enabled: false,
    });
  }

  return NextResponse.json(data);
}
