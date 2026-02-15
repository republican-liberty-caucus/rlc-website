import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { STEP_ORDER } from '@/lib/onboarding/constants';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

const createOnboardingSchema = z.object({
  coordinatorId: z.string().uuid().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id: charterId } = await params;
  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select(`
      *,
      coordinator:rlc_contacts!rlc_charter_onboarding_coordinator_id_fkey(id, first_name, last_name, email),
      steps:rlc_charter_onboarding_steps(*)
    `)
    .eq('charter_id', charterId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching onboarding:', error);
    return apiError('Failed to fetch onboarding', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ onboarding: data || null });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!ctx.isNational) {
    return apiError('Forbidden: national admin required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: charterId } = await params;

  // Verify charter exists and is forming
  const { data: charter, error: charterError } = await supabase
    .from('rlc_charters')
    .select('id, status')
    .eq('id', charterId)
    .single();

  if (charterError || !charter) {
    if (charterError && charterError.code !== 'PGRST116') {
      logger.error('Error looking up charter for onboarding:', charterError);
      return apiError('Failed to verify charter', ApiErrorCode.INTERNAL_ERROR, 500);
    }
    return apiError('Charter not found', ApiErrorCode.NOT_FOUND, 404);
  }

  if ((charter as { status: string }).status !== 'forming') {
    return apiError('Charter must be in "forming" status', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  // Check for existing onboarding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: existingError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select('id')
    .eq('charter_id', charterId)
    .single();

  if (existing) {
    return apiError('Onboarding already exists for this charter', ApiErrorCode.CONFLICT, 409);
  }
  // If error is not "no rows found", it's a real error
  if (existingError && existingError.code !== 'PGRST116') {
    logger.error('Error checking existing onboarding:', existingError);
    return apiError('Failed to check existing onboarding', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = createOnboardingSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const coordinatorId = parseResult.data.coordinatorId || ctx.member.id;

  // Create onboarding record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: onboarding, error: insertError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .insert({
      charter_id: charterId,
      coordinator_id: coordinatorId,
    })
    .select()
    .single();

  if (insertError || !onboarding) {
    logger.error('Error creating onboarding:', insertError);
    return apiError('Failed to create onboarding', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const onboardingRow = onboarding as { id: string };

  // Create step records for all 8 steps
  const stepInserts = STEP_ORDER.map((step) => ({
    onboarding_id: onboardingRow.id,
    step,
    status: 'not_started',
    data: {},
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: stepsError } = await (supabase as any)
    .from('rlc_charter_onboarding_steps')
    .insert(stepInserts);

  if (stepsError) {
    logger.error('Error creating onboarding steps:', stepsError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: cleanupError } = await (supabase as any).from('rlc_charter_onboarding').delete().eq('id', onboardingRow.id);
    if (cleanupError) {
      logger.error('Failed to clean up orphaned onboarding record:', { onboardingId: onboardingRow.id, cleanupError });
    }
    return apiError('Failed to create onboarding steps', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  // Fetch the complete record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: complete, error: refetchError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select(`
      *,
      coordinator:rlc_contacts!rlc_charter_onboarding_coordinator_id_fkey(id, first_name, last_name, email),
      steps:rlc_charter_onboarding_steps(*)
    `)
    .eq('id', onboardingRow.id)
    .single();

  if (refetchError) {
    logger.error('Created onboarding but failed to refetch complete record:', refetchError);
  }

  return NextResponse.json({ onboarding: complete || onboarding }, { status: 201 });
}
