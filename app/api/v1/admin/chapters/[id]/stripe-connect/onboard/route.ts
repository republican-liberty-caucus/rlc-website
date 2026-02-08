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

  const { id: chapterId } = await params;

  // Check chapter visibility
  if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Get chapter details
  const { data: chapter, error: chapterError } = await supabase
    .from('rlc_chapters')
    .select('id, name, contact_email')
    .eq('id', chapterId)
    .single();

  if (chapterError || !chapter) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
  }

  const chapterRow = chapter as { id: string; name: string; contact_email: string | null };

  // Check if already has a Stripe account
  const { data: existing } = await supabase
    .from('rlc_chapter_stripe_accounts')
    .select('id, stripe_account_id, status')
    .eq('chapter_id', chapterId)
    .single();

  let stripeAccountId: string;

  if (existing) {
    const existingRow = existing as { id: string; stripe_account_id: string; status: string };
    stripeAccountId = existingRow.stripe_account_id;
  } else {
    // Create new Stripe Express account
    const account = await createConnectAccount({
      chapterName: chapterRow.name,
      chapterEmail: chapterRow.contact_email || ctx.member.email,
    });

    stripeAccountId = account.id;

    // Store in database
    const { error: insertError } = await supabase
      .from('rlc_chapter_stripe_accounts')
      .insert({
        chapter_id: chapterId,
        stripe_account_id: account.id,
        status: 'onboarding',
      } as never);

    if (insertError) {
      logger.error(`Failed to create ChapterStripeAccount for ${chapterId}:`, insertError);
      return NextResponse.json({ error: 'Failed to save account' }, { status: 500 });
    }
  }

  // Generate onboarding link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rlc.org';
  const returnUrl = `${baseUrl}/admin/chapters/${chapterId}/banking?onboarding=complete`;
  const refreshUrl = `${baseUrl}/admin/chapters/${chapterId}/banking?onboarding=refresh`;

  const accountLink = await createAccountLink({
    stripeAccountId,
    returnUrl,
    refreshUrl,
  });

  return NextResponse.json({ url: accountLink.url });
}
