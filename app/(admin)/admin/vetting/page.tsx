import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline, canCreateVetting } from '@/lib/vetting/permissions';
import { calculateUrgency } from '@/lib/vetting/engine';
import { PageHeader } from '@/components/ui/page-header';
import { PipelineTable } from '@/components/admin/vetting/pipeline-table';
import { PendingSubmissions } from '@/components/admin/vetting/pending-submissions';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';

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

interface PendingCandidate {
  id: string;
  candidate_name: string;
  candidate_office: string | null;
  candidate_state: string | null;
  candidate_district: string | null;
  total_score: number | null;
  submitted_at: string | null;
  survey: { id: string; title: string } | null;
}

export default async function VettingPipelinePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getVettingContext(userId);
  if (!ctx || !canViewPipeline(ctx)) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();
  const canCreate = canCreateVetting(ctx);

  // Fetch active vettings and pending submissions in parallel
  let vettingQuery = supabase
    .from('rlc_candidate_vettings')
    .select('id, candidate_name, candidate_state, candidate_office, candidate_district, charter_id, stage, recommendation, created_at, office_type:rlc_office_types(name, district_label), election_deadline:rlc_candidate_election_deadlines(primary_date, general_date)')
    .order('created_at', { ascending: false });

  if (ctx.visibleCharterIds !== null) {
    vettingQuery = vettingQuery.in('charter_id', ctx.visibleCharterIds);
  }

  const [vettingRes, pendingRes] = await Promise.all([
    vettingQuery,
    // Submitted responses that don't have a vetting yet
    supabase
      .from('rlc_candidate_responses')
      .select(`
        id, candidate_name, candidate_office, candidate_state, candidate_district,
        total_score, submitted_at,
        survey:rlc_surveys(id, title)
      `)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false }),
  ]);

  if (vettingRes.error) throw new Error(`Failed to fetch vettings: ${vettingRes.error.message}`);
  if (pendingRes.error) throw new Error(`Failed to fetch pending submissions: ${pendingRes.error.message}`);

  const vettings = (vettingRes.data || []) as VettingRow[];

  // Check the full vettings table for response IDs since the pipeline query
  // may be charter-scoped but pending submissions should only show truly un-vetted ones
  const { data: allVettingResponseIds, error: linkedIdsError } = await supabase
    .from('rlc_candidate_vettings')
    .select('candidate_response_id');

  if (linkedIdsError) throw new Error(`Failed to fetch linked vetting IDs: ${linkedIdsError.message}`);

  const allLinkedIds = new Set(
    (allVettingResponseIds || [])
      .map((v: { candidate_response_id: string | null }) => v.candidate_response_id)
      .filter(Boolean)
  );

  const pending = ((pendingRes.data || []) as PendingCandidate[]).filter(
    (p) => !allLinkedIds.has(p.id)
  );

  // Enrich vettings with urgency
  const enriched = vettings.map((v) => ({
    ...v,
    urgency: calculateUrgency(v.election_deadline?.primary_date ?? null),
  }));

  return (
    <div>
      <PageHeader
        title="Candidate Pipeline"
        count={vettings.length}
        className="mb-8"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/surveys" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              New Questionnaire
            </Link>
          </Button>
        }
      />

      {/* Pending Review Section */}
      {pending.length > 0 && canCreate && (
        <PendingSubmissions candidates={pending} />
      )}

      <PipelineTable vettings={enriched} />
    </div>
  );
}
