import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (!member.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found. Please join or renew your membership first.' },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;
    const stripe = getStripe();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: member.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      logger.error('Billing portal: invalid Stripe customer', error);
      return NextResponse.json(
        { error: 'Your subscription information is outdated. Please contact support.' },
        { status: 400 }
      );
    }
    logger.error('Billing portal session creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
