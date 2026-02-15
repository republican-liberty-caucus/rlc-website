import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
    }

    if (!member.stripe_customer_id) {
      return apiError('No subscription found. Please join or renew your membership first.', ApiErrorCode.VALIDATION_ERROR, 400);
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
      return apiError('Your subscription information is outdated. Please contact support.', ApiErrorCode.VALIDATION_ERROR, 400);
    }
    logger.error('Billing portal session creation failed:', error);
    return apiError('Failed to create billing portal session', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
