import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { STEP_ORDER } from '@/lib/onboarding/constants';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createOnboardingSchema = z.object({
  coordinatorId: z.string().uuid().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: charterId } = await params;
  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();
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
    return NextResponse.json({ error: 'Failed to fetch onboarding' }, { status: 500 });
  }

  return NextResponse.json({ onboarding: data || null });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ctx = await getAdminContext(userId);
  if (!ctx || !ctx.isNational) {
    return NextResponse.json({ error: 'Forbidden: national admin required' }, { status: 403 });
  }

  const { id: charterId } = await params;
  const supabase = createServerClient();

  // Verify charter exists and is forming
  const { data: charter, error: charterError } = await supabase
    .from('rlc_charters')
    .select('id, status')
    .eq('id', charterId)
    .single();

  if (charterError || !charter) {
    if (charterError && charterError.code !== 'PGRST116') {
      logger.error('Error looking up charter for onboarding:', charterError);
      return NextResponse.json({ error: 'Failed to verify charter' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Charter not found' }, { status: 404 });
  }

  if ((charter as { status: string }).status !== 'forming') {
    return NextResponse.json({ error: 'Charter must be in "forming" status' }, { status: 400 });
  }

  // Check for existing onboarding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: existingError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select('id')
    .eq('charter_id', charterId)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Onboarding already exists for this charter' }, { status: 409 });
  }
  // If error is not "no rows found", it's a real error
  if (existingError && existingError.code !== 'PGRST116') {
    logger.error('Error checking existing onboarding:', existingError);
    return NextResponse.json({ error: 'Failed to check existing onboarding' }, { status: 500 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = createOnboardingSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid input', details: parseResult.error.flatten() }, { status: 400 });
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
    return NextResponse.json({ error: 'Failed to create onboarding' }, { status: 500 });
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
    return NextResponse.json({ error: 'Failed to create onboarding steps' }, { status: 500 });
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
