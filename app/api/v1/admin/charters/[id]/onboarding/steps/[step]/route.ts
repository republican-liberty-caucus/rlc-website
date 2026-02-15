import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { logger } from '@/lib/logger';
import { getStepDefinition } from '@/lib/onboarding/constants';
import { areDependenciesMet, isValidTransition } from '@/lib/onboarding/engine';
import { STEP_DATA_SCHEMAS } from '@/lib/validations/onboarding';
import type { OnboardingStep, OnboardingStepStatus } from '@/types';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

interface StepRow {
  id: string;
  step: string;
  status: string;
  data: Record<string, unknown>;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; step: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id: charterId, step } = await params;
  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: onboarding, error: onboardingError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select('id')
    .eq('charter_id', charterId)
    .single();

  if (onboardingError || !onboarding) {
    if (onboardingError && onboardingError.code !== 'PGRST116') {
      logger.error('Error fetching onboarding:', onboardingError);
      return apiError('Failed to fetch onboarding', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('No onboarding found', ApiErrorCode.NOT_FOUND, 404);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stepData, error } = await (supabase as any)
    .from('rlc_charter_onboarding_steps')
    .select('*')
    .eq('onboarding_id', (onboarding as { id: string }).id)
    .eq('step', step)
    .single();

  if (error || !stepData) {
    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching step:', error);
      return apiError('Failed to fetch step', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('Step not found', ApiErrorCode.NOT_FOUND, 404);
  }

  return NextResponse.json({ step: stepData });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; step: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id: charterId, step: stepName } = await params;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  let body: { action: string; data?: Record<string, unknown>; reviewNotes?: string };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const { action, data: formData, reviewNotes } = body;
  const validActions = ['save_draft', 'complete', 'approve', 'reject'];
  if (!validActions.includes(action)) {
    return apiError(`Invalid action. Must be one of: ${validActions.join(', ')}`, ApiErrorCode.VALIDATION_ERROR, 400);
  }

  // Fetch onboarding and all steps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: onboarding, error: onboardingFetchErr } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select('id')
    .eq('charter_id', charterId)
    .single();

  if (onboardingFetchErr || !onboarding) {
    if (onboardingFetchErr && onboardingFetchErr.code !== 'PGRST116') {
      logger.error('Error fetching onboarding:', onboardingFetchErr);
      return apiError('Failed to fetch onboarding', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('No onboarding found', ApiErrorCode.NOT_FOUND, 404);
  }

  const onboardingRow = onboarding as { id: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allStepsRaw, error: stepsFetchErr } = await (supabase as any)
    .from('rlc_charter_onboarding_steps')
    .select('*')
    .eq('onboarding_id', onboardingRow.id);

  if (stepsFetchErr || !allStepsRaw) {
    logger.error('Error fetching steps:', stepsFetchErr);
    return apiError('Failed to fetch steps', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const allSteps = allStepsRaw as StepRow[];
  const currentStep = allSteps.find((s) => s.step === stepName);
  if (!currentStep) {
    return apiError('Step not found', ApiErrorCode.NOT_FOUND, 404);
  }

  const stepDef = getStepDefinition(stepName as OnboardingStep);
  if (!stepDef) {
    return apiError('Invalid step', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const updates: Record<string, unknown> = {};

  if (action === 'save_draft') {
    updates.data = formData || {};
    if (currentStep.status === 'not_started') {
      updates.status = 'in_progress';
    }
  } else if (action === 'complete') {
    // Verify dependencies
    const stepsState = allSteps.map((s) => ({ step: s.step as OnboardingStep, status: s.status as OnboardingStepStatus }));
    if (!areDependenciesMet(stepName as OnboardingStep, stepsState)) {
      return apiError('Dependencies not met', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    const targetStatus: OnboardingStepStatus = 'completed';
    if (!isValidTransition(currentStep.status as OnboardingStepStatus, targetStatus, stepDef.requiresReview) &&
        currentStep.status !== 'not_started') {
      return apiError(`Cannot complete step from status "${currentStep.status}"`, ApiErrorCode.VALIDATION_ERROR, 400);
    }

    // Validate step data against schema on completion
    const schema = STEP_DATA_SCHEMAS[stepName as OnboardingStep];
    const dataToValidate = formData ?? currentStep.data;
    if (schema) {
      if (!dataToValidate || Object.keys(dataToValidate).length === 0) {
        return apiError('Step data is required for completion', ApiErrorCode.VALIDATION_ERROR, 400);
      }
      const parseResult = schema.safeParse(dataToValidate);
      if (!parseResult.success) {
        return validationError(parseResult.error);
      }
    }
    if (formData) {
      updates.data = formData;
    }
    // If step doesn't require review, mark as approved directly
    updates.status = stepDef.requiresReview ? 'completed' : 'approved';
    updates.completed_at = new Date().toISOString();
    updates.completed_by_id = ctx.member.id;

    // For step 5 (organizational meeting), create officer positions
    if (stepName === 'organizational_meeting' && formData) {
      const meetingData = formData as { officers?: Array<{ member_id?: string; name: string; title: string }> };
      if (meetingData.officers && Array.isArray(meetingData.officers)) {
        const officerErrors: string[] = [];
        for (const officer of meetingData.officers) {
          if (officer.member_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: upsertError } = await (supabase as any).from('rlc_organizational_positions').upsert({
              contact_id: officer.member_id,
              charter_id: charterId,
              title: officer.title,
              started_at: new Date().toISOString(),
              is_active: true,
              appointed_by_id: ctx.member.id,
            }, {
              onConflict: 'contact_id,charter_id,title,committee_name',
            });
            if (upsertError) {
              logger.error('Error upserting officer position:', { officer, charterId, error: upsertError });
              officerErrors.push(`${officer.name || officer.member_id}: ${upsertError.message}`);
            }
          }
        }
        if (officerErrors.length > 0) {
          logger.error('Some officer positions failed to create:', { charterId, errors: officerErrors });
          return apiError(`Failed to create officer positions: ${officerErrors.join('; ')}`, ApiErrorCode.INTERNAL_ERROR, 500);
        }
      }
    }
  } else if (action === 'approve' || action === 'reject') {
    if (!ctx.isNational) {
      return apiError(`Only national admins can ${action}`, ApiErrorCode.FORBIDDEN, 403);
    }
    if (currentStep.status !== 'completed') {
      return apiError(`Can only ${action} completed steps`, ApiErrorCode.VALIDATION_ERROR, 400);
    }
    updates.status = action === 'approve' ? 'approved' : 'rejected';
    updates.reviewed_at = new Date().toISOString();
    updates.reviewed_by_id = ctx.member.id;
    if (reviewNotes) updates.review_notes = reviewNotes;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (supabase as any)
    .from('rlc_charter_onboarding_steps')
    .update(updates)
    .eq('id', currentStep.id)
    .select()
    .single();

  if (updateError) {
    logger.error('Error updating step:', updateError);
    return apiError('Failed to update step', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ step: updated });
}
