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

  const { id: chapterId } = await params;

  if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_chapter_stripe_accounts')
    .select('id, stripe_account_id, status, charges_enabled, payouts_enabled, onboarding_completed_at, created_at')
    .eq('chapter_id', chapterId)
    .single();

  if (error || !data) {
    return NextResponse.json({
      status: 'not_started',
      charges_enabled: false,
      payouts_enabled: false,
    });
  }

  return NextResponse.json(data);
}
