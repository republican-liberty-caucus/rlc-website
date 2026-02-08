import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { isOnboardingComplete } from '@/lib/onboarding/engine';
import { logger } from '@/lib/logger';
import type { OnboardingStep, OnboardingStepStatus } from '@/types';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx || !ctx.isNational) {
    return NextResponse.json({ error: 'Forbidden: national admin required' }, { status: 403 });
  }

  const { id: chapterId } = await params;
  const supabase = createServerClient();

  // Fetch onboarding with steps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawOnboarding, error: fetchError } = await (supabase as any)
    .from('rlc_chapter_onboarding')
    .select('*, steps:rlc_chapter_onboarding_steps(*)')
    .eq('chapter_id', chapterId)
    .single();

  if (fetchError || !rawOnboarding) {
    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Error fetching onboarding for approval:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch onboarding' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Onboarding not found' }, { status: 404 });
  }

  const onboarding = rawOnboarding as { id: string; approved_at: string | null; steps: Array<{ step: string; status: string }> };

  if (onboarding.approved_at) {
    return NextResponse.json({ error: 'Already approved' }, { status: 400 });
  }

  // Check all steps are complete
  const steps = (onboarding.steps || []).map((s) => ({
    step: s.step as OnboardingStep,
    status: s.status as OnboardingStepStatus,
  }));

  if (!isOnboardingComplete(steps)) {
    return NextResponse.json({ error: 'Not all steps are complete' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Update onboarding as approved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: onboardingError } = await (supabase as any)
    .from('rlc_chapter_onboarding')
    .update({
      approved_at: now,
      approved_by_id: ctx.member.id,
      completed_at: now,
    })
    .eq('id', onboarding.id);

  if (onboardingError) {
    logger.error('Error approving onboarding:', onboardingError);
    return NextResponse.json({ error: 'Failed to approve onboarding' }, { status: 500 });
  }

  // Transition chapter from forming → active
  const { error: chapterError } = await supabase
    .from('rlc_chapters')
    .update({ status: 'active' } as never)
    .eq('id', chapterId);

  if (chapterError) {
    logger.error('Error activating chapter:', chapterError);
    // Rollback the onboarding approval to avoid inconsistent state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rollbackError } = await (supabase as any)
      .from('rlc_chapter_onboarding')
      .update({ approved_at: null, approved_by_id: null, completed_at: null })
      .eq('id', onboarding.id);
    if (rollbackError) {
      logger.error('CRITICAL: Rollback of onboarding approval failed — inconsistent state', {
        chapterId,
        onboardingId: onboarding.id,
        rollbackError,
        originalError: chapterError,
      });
      return NextResponse.json(
        { error: 'Failed to activate chapter and rollback failed. Contact support.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Failed to activate chapter. Approval rolled back — please retry.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Chapter onboarding approved and chapter activated' });
}
