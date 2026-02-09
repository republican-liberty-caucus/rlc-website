import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { getStepDefinition } from '@/lib/onboarding/constants';
import { areDependenciesMet, isValidTransition } from '@/lib/onboarding/engine';
import { STEP_DATA_SCHEMAS } from '@/lib/validations/onboarding';
import { logger } from '@/lib/logger';
import type { OnboardingStep, OnboardingStepStatus } from '@/types';

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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: charterId, step } = await params;
  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: onboarding, error: onboardingError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select('id')
    .eq('charter_id', charterId)
    .single();

  if (onboardingError || !onboarding) {
    if (onboardingError && onboardingError.code !== 'PGRST116') {
      logger.error('Error fetching onboarding:', onboardingError);
      return NextResponse.json({ error: 'Failed to fetch onboarding' }, { status: 500 });
    }
    return NextResponse.json({ error: 'No onboarding found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Failed to fetch step' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  }

  return NextResponse.json({ step: stepData });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; step: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: charterId, step: stepName } = await params;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { action: string; data?: Record<string, unknown>; reviewNotes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, data: formData, reviewNotes } = body;
  const validActions = ['save_draft', 'complete', 'approve', 'reject'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
  }

  const supabase = createServerClient();

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
      return NextResponse.json({ error: 'Failed to fetch onboarding' }, { status: 500 });
    }
    return NextResponse.json({ error: 'No onboarding found' }, { status: 404 });
  }

  const onboardingRow = onboarding as { id: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allStepsRaw, error: stepsFetchErr } = await (supabase as any)
    .from('rlc_charter_onboarding_steps')
    .select('*')
    .eq('onboarding_id', onboardingRow.id);

  if (stepsFetchErr || !allStepsRaw) {
    logger.error('Error fetching steps:', stepsFetchErr);
    return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 });
  }

  const allSteps = allStepsRaw as StepRow[];
  const currentStep = allSteps.find((s) => s.step === stepName);
  if (!currentStep) {
    return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  }

  const stepDef = getStepDefinition(stepName as OnboardingStep);
  if (!stepDef) {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
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
      return NextResponse.json({ error: 'Dependencies not met' }, { status: 400 });
    }

    const targetStatus: OnboardingStepStatus = 'completed';
    if (!isValidTransition(currentStep.status as OnboardingStepStatus, targetStatus, stepDef.requiresReview) &&
        currentStep.status !== 'not_started') {
      return NextResponse.json({ error: `Cannot complete step from status "${currentStep.status}"` }, { status: 400 });
    }

    // Validate step data against schema on completion
    const schema = STEP_DATA_SCHEMAS[stepName as OnboardingStep];
    const dataToValidate = formData ?? currentStep.data;
    if (schema) {
      if (!dataToValidate || Object.keys(dataToValidate).length === 0) {
        return NextResponse.json(
          { error: 'Step data is required for completion' },
          { status: 400 }
        );
      }
      const parseResult = schema.safeParse(dataToValidate);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid step data', details: parseResult.error.flatten() },
          { status: 400 }
        );
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
            const { error: upsertError } = await (supabase as any).from('rlc_officer_positions').upsert({
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
          return NextResponse.json(
            { error: `Failed to create officer positions: ${officerErrors.join('; ')}` },
            { status: 500 }
          );
        }
      }
    }
  } else if (action === 'approve' || action === 'reject') {
    if (!ctx.isNational) {
      return NextResponse.json({ error: `Only national admins can ${action}` }, { status: 403 });
    }
    if (currentStep.status !== 'completed') {
      return NextResponse.json({ error: `Can only ${action} completed steps` }, { status: 400 });
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
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }

  return NextResponse.json({ step: updated });
}
