import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { isOnboardingComplete } from '@/lib/onboarding/engine';
import { logger } from '@/lib/logger';
import type { OnboardingStep, OnboardingStepStatus } from '@/types';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!ctx.isNational) {
    return apiError('Forbidden: national admin required', ApiErrorCode.FORBIDDEN, 403);
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
      return apiError('Failed to fetch onboarding', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('Onboarding not found', ApiErrorCode.NOT_FOUND, 404);
  }

  const onboarding = rawOnboarding as { id: string; approved_at: string | null; steps: Array<{ step: string; status: string }> };

  if (onboarding.approved_at) {
    return apiError('Already approved', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  // Check all steps are complete
  const steps = (onboarding.steps || []).map((s) => ({
    step: s.step as OnboardingStep,
    status: s.status as OnboardingStepStatus,
  }));

  if (!isOnboardingComplete(steps)) {
    return apiError('Not all steps are complete', ApiErrorCode.VALIDATION_ERROR, 400);
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
    return apiError('Failed to approve onboarding', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  // Verify charter is still in forming status before activation
  const { data: charterRow, error: charterFetchError } = await supabase
    .from('rlc_charters')
    .select('status')
    .eq('id', charterId)
    .single();

  if (charterFetchError || !charterRow) {
    logger.error('Error fetching charter for approval:', charterFetchError);
    return apiError('Failed to verify charter status', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  if ((charterRow as { status: string }).status !== 'forming') {
    return apiError('Charter is no longer in forming status', ApiErrorCode.CONFLICT, 409);
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
      return apiError('Failed to activate charter and rollback failed. Contact support.', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('Failed to activate charter. Approval rolled back — please retry.', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ success: true, message: 'Charter onboarding approved and charter activated' });
}
