import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDonationCheckoutSession } from '@/lib/stripe/client';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const donateSchema = z.object({
  amount: z.number().int().min(100).max(10000000), // $1 to $100,000 in cents
  isRecurring: z.boolean().default(false),
  email: z.string().email(),
  chapterId: z.string().uuid().optional(),
  campaignId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = donateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, isRecurring, email, chapterId, campaignId } = parseResult.data;
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
      chapterId,
      campaignId,
      successUrl: `${origin}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/donate?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Donation checkout creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create donation checkout' },
      { status: 500 }
    );
  }
}
