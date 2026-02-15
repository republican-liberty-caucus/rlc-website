import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCheckoutSession, MEMBERSHIP_TIERS } from '@/lib/stripe/client';
import { getMemberByClerkId } from '@/lib/supabase/server';
import type { MembershipTier } from '@/types';
import { logger } from '@/lib/logger';

const validTiers = MEMBERSHIP_TIERS.map((t) => t.tier) as [string, ...string[]];

const checkoutSchema = z.object({
  tier: z.enum(validTiers as [MembershipTier, ...MembershipTier[]]),
  email: z.string().email().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = checkoutSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { tier } = parseResult.data;
    const origin = new URL(request.url).origin;

    // Check if user is authenticated
    const { userId } = await auth();
    let memberEmail = parseResult.data.email;
    let memberId: string | undefined;

    // If authenticated, use their member record (or fall back to Clerk email for new users)
    if (userId) {
      const member = await getMemberByClerkId(userId);
      if (member) {
        memberEmail = member.email;
        memberId = member.id;
      } else if (!memberEmail) {
        // New user who signed up through Clerk but hasn't completed checkout yet —
        // no rlc_contacts record exists. Get their email from Clerk directly.
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(userId);
        memberEmail = clerkUser.emailAddresses[0]?.emailAddress;
      }
    }

    if (!memberEmail) {
      return NextResponse.json(
        { error: 'Email is required for unauthenticated checkout' },
        { status: 400 }
      );
    }

    const session = await createCheckoutSession({
      tier: tier as MembershipTier,
      memberEmail,
      memberId,
      returnUrl: `${origin}/join/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.client_secret) {
      logger.error('Checkout session created but client_secret is null', {
        sessionId: session.id,
        tier,
        uiMode: session.ui_mode,
      });
      return NextResponse.json(
        { error: 'Failed to initialize payment form' },
        { status: 500 }
      );
    }

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error) {
    const err = error as { message?: string; type?: string; code?: string };
    logger.error('Checkout session creation failed:', {
      message: err.message ?? 'Unknown error',
      type: err.type,
      code: err.code,
    });
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
