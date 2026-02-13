import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, getRoleWeight } from '@/lib/admin/permissions';
import { createConnectAccount, createAccountLink } from '@/lib/stripe/client';
import { logger } from '@/lib/logger';

export async function POST(
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

  // Require state_chair or higher
  if (getRoleWeight(ctx.highestRole) < getRoleWeight('state_chair')) {
    return NextResponse.json({ error: 'Forbidden: state_chair role required' }, { status: 403 });
  }

  const { id: charterId } = await params;

  // Check charter visibility
  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Get charter details
  const { data: charter, error: charterError } = await supabase
    .from('rlc_charters')
    .select('id, name, contact_email')
    .eq('id', charterId)
    .single();

  if (charterError || !charter) {
    return NextResponse.json({ error: 'Charter not found' }, { status: 404 });
  }

  const charterRow = charter as { id: string; name: string; contact_email: string | null };

  // Check if already has a Stripe account
  const { data: existing } = await supabase
    .from('rlc_charter_stripe_accounts')
    .select('id, stripe_account_id, status')
    .eq('charter_id', charterId)
    .single();

  let stripeAccountId: string;

  if (existing) {
    const existingRow = existing as { id: string; stripe_account_id: string; status: string };
    stripeAccountId = existingRow.stripe_account_id;
  } else {
    // Create new Stripe Express account
    let account;
    try {
      account = await createConnectAccount({
        charterName: charterRow.name,
        charterEmail: charterRow.contact_email || ctx.member.email,
      });
    } catch (stripeError) {
      logger.error(`Failed to create Stripe Connect account for ${charterId}:`, stripeError);
      return NextResponse.json(
        { error: 'Failed to create Stripe account. Please try again or contact support.' },
        { status: 500 }
      );
    }

    stripeAccountId = account.id;

    // Store in database
    const { error: insertError } = await supabase
      .from('rlc_charter_stripe_accounts')
      .insert({
        charter_id: charterId,
        stripe_account_id: account.id,
        status: 'onboarding',
      } as never);

    if (insertError) {
      logger.error(`Failed to create CharterStripeAccount for ${charterId}:`, insertError);
      return NextResponse.json({ error: 'Failed to save account' }, { status: 500 });
    }
  }

  // Generate onboarding link
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://rlc.org').trim();
  const returnUrl = `${baseUrl}/admin/charters/${charterId}/banking?onboarding=complete`;
  const refreshUrl = `${baseUrl}/admin/charters/${charterId}/banking?onboarding=refresh`;

  let accountLink;
  try {
    accountLink = await createAccountLink({
      stripeAccountId,
      returnUrl,
      refreshUrl,
    });
  } catch (stripeError) {
    logger.error(`Failed to create account link for ${stripeAccountId}:`, stripeError);
    return NextResponse.json(
      { error: 'Failed to generate onboarding link. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: accountLink.url });
}
