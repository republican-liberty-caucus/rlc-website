import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { OnboardingWizard } from '@/components/admin/onboarding/onboarding-wizard';
import { ArrowLeft } from 'lucide-react';
import type { Charter, CharterOnboarding, CharterOnboardingStep } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from('rlc_charters').select('name').eq('id', id).single();
  if (error && error.code !== 'PGRST116') {
    console.error('generateMetadata: Error fetching charter name:', error);
  }
  const charter = data as { name: string } | null;
  return { title: charter ? `Onboarding — ${charter.name}` : 'Onboarding' };
}

export default async function CharterOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { ctx, supabase } = await requireAdmin();

  const { id } = await params;
  const { step: activeStep } = await searchParams;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(id)) {
    redirect('/admin/charters?error=forbidden');
  }

  const { data: charterData, error: charterError } = await supabase
    .from('rlc_charters')
    .select('*')
    .eq('id', id)
    .single();

  if (charterError || !charterData) notFound();
  const charter = charterData as Charter;

  if (charter.status !== 'forming') {
    redirect(`/admin/charters/${id}`);
  }

  // Fetch onboarding — use any cast since this is a new table not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: onboardingData, error: onboardingError } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .select(`
      *,
      coordinator:rlc_contacts!rlc_charter_onboarding_coordinator_id_fkey(id, first_name, last_name, email),
      steps:rlc_charter_onboarding_steps(*)
    `)
    .eq('charter_id', id)
    .single();

  // PGRST116 = no rows found (expected for charters without onboarding)
  if (onboardingError && onboardingError.code !== 'PGRST116') {
    throw new Error(`Failed to load onboarding data: ${onboardingError.message}`);
  }

  const onboarding = onboardingData as (CharterOnboarding & {
    coordinator: { id: string; first_name: string; last_name: string; email: string };
    steps: CharterOnboardingStep[];
  }) | null;

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/charters/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Charter
        </Link>
      </div>

      <OnboardingWizard
        charterId={id}
        charterName={charter.name}
        onboarding={onboarding}
        activeStep={activeStep}
        isNational={ctx.isNational}
        currentMemberId={ctx.member.id}
      />
    </div>
  );
}
