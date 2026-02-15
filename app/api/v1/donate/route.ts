import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDonationCheckoutSession } from '@/lib/stripe/client';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

const donateSchema = z.object({
  amount: z.number().int().min(100).max(10000000), // $1 to $100,000 in cents
  isRecurring: z.boolean().default(false),
  email: z.string().email(),
  charterId: z.string().uuid().optional(),
  campaignId: z.string().optional(),
});

export async function POST(request: Request) {
  const rateLimited = applyRateLimit(request, 'payment');
  if (rateLimited) return rateLimited;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = donateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { amount, isRecurring, email, charterId, campaignId } = parseResult.data;
    const origin = new URL(request.url).origin;

    // Check if user is authenticated
    const { userId } = await auth();
    let memberId: string | undefined;

    if (userId) {
      const member = await getMemberByClerkId(userId);
      if (member) {
        memberId = member.id;
      }
    }

    const session = await createDonationCheckoutSession({
      amount,
      isRecurring,
      donorEmail: email,
      memberId,
      charterId,
      campaignId,
      successUrl: `${origin}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/donate?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Donation checkout creation failed:', error);
    return apiError('Failed to create donation checkout', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
