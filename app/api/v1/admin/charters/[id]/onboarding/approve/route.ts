import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { isOnboardingComplete } from '@/lib/onboarding/engine';
import { logger } from '@/lib/logger';
import type { OnboardingStep, OnboardingStepStatus } from '@/types';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!ctx.isNational) {
    return NextResponse.json({ error: 'Forbidden: national admin required' }, { status: 403 });
  }

  const { id: charterId } = await params;

  // Fetch onboarding with steps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawOnboarding, error: fetchError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select('*, steps:rlc_charter_onboarding_steps(*)')
    .eq('charter_id', charterId)
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
    .from('rlc_charter_onboarding')
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

  // Verify charter is still in forming status before activation
  const { data: charterRow, error: charterFetchError } = await supabase
    .from('rlc_charters')
    .select('status')
    .eq('id', charterId)
    .single();

  if (charterFetchError || !charterRow) {
    logger.error('Error fetching charter for approval:', charterFetchError);
    return NextResponse.json({ error: 'Failed to verify charter status' }, { status: 500 });
  }

  if ((charterRow as { status: string }).status !== 'forming') {
    return NextResponse.json({ error: 'Charter is no longer in forming status' }, { status: 409 });
  }

  // Transition charter from forming → active
  const { error: charterError } = await supabase
    .from('rlc_charters')
    .update({ status: 'active' } as never)
    .eq('id', charterId);

  if (charterError) {
    logger.error('Error activating charter:', charterError);
    // Rollback the onboarding approval to avoid inconsistent state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rollbackError } = await (supabase as any)
      .from('rlc_charter_onboarding')
      .update({ approved_at: null, approved_by_id: null, completed_at: null })
      .eq('id', onboarding.id);
    if (rollbackError) {
      logger.error('CRITICAL: Rollback of onboarding approval failed — inconsistent state', {
        charterId,
        onboardingId: onboarding.id,
        rollbackError,
        originalError: charterError,
      });
      return NextResponse.json(
        { error: 'Failed to activate charter and rollback failed. Contact support.' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Failed to activate charter. Approval rolled back — please retry.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Charter onboarding approved and charter activated' });
}
