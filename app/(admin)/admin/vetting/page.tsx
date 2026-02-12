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
  charter_id: string | null;
  office_type: { name: string; district_label: string | null } | null;
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

  let query = supabase
    .from('rlc_candidate_vettings')
    .select('id, candidate_name, candidate_state, candidate_office, candidate_district, charter_id, stage, recommendation, created_at, office_type:rlc_office_types(name, district_label), election_deadline:rlc_candidate_election_deadlines(primary_date, general_date)')
    .order('created_at', { ascending: false });

  // Charter-scoped admins only see vettings for their charters
  if (ctx.visibleCharterIds !== null) {
    query = query.in('charter_id', ctx.visibleCharterIds);
  }

  const { data, error } = await query;

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
