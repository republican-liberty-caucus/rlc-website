import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline } from '@/lib/vetting/permissions';
import { calculateUrgency } from '@/lib/vetting/engine';
import { PageHeader } from '@/components/ui/page-header';
import { PipelineTable } from '@/components/admin/vetting/pipeline-table';

export const metadata: Metadata = {
  title: 'Candidate Vetting - Admin',
  description: 'Candidate vetting pipeline dashboard',
};

interface VettingRow {
  id: string;
  candidate_name: string;
  candidate_state: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  stage: string;
  recommendation: string | null;
  created_at: string;
  election_deadline: {
    primary_date: string | null;
    general_date: string | null;
  } | null;
}

export default async function VettingPipelinePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getVettingContext(userId);
  if (!ctx || !canViewPipeline(ctx)) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_vettings')
    .select('id, candidate_name, candidate_state, candidate_office, candidate_district, stage, recommendation, created_at, election_deadline:rlc_candidate_election_deadlines(primary_date, general_date)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch vettings: ${error.message}`);

  const vettings = (data || []) as VettingRow[];

  // Enrich with urgency
  const enriched = vettings.map((v) => ({
    ...v,
    urgency: calculateUrgency(v.election_deadline?.primary_date ?? null),
  }));

  return (
    <div>
      <PageHeader
        title="Candidate Vetting Pipeline"
        count={vettings.length}
        className="mb-8"
      />

      <PipelineTable vettings={enriched} />
    </div>
  );
}
