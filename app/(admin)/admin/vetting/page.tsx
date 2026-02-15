import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline, canCreateVetting } from '@/lib/vetting/permissions';
import { calculateUrgency } from '@/lib/vetting/engine';
import { PageHeader } from '@/components/ui/page-header';
import { PipelineTable } from '@/components/admin/vetting/pipeline-table';
import { AddCandidateDialog } from '@/components/admin/vetting/add-candidate-dialog';
import type { PipelineRow } from '@/components/admin/vetting/pipeline-table';

export const metadata: Metadata = {
  title: 'Candidate Vetting - Admin',
  description: 'Candidate vetting pipeline dashboard',
};

interface VettingRow {
  id: string;
  candidate_response_id: string | null;
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

interface SubmissionRow {
  id: string;
  candidate_name: string;
  candidate_office: string | null;
  candidate_state: string | null;
  candidate_district: string | null;
  contact_id: string | null;
  total_score: number | null;
  submitted_at: string | null;
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
    .select('id, candidate_response_id, candidate_name, candidate_state, candidate_office, candidate_district, charter_id, stage, recommendation, created_at, office_type:rlc_office_types(name, district_label), election_deadline:rlc_candidate_election_deadlines(primary_date, general_date)')
    .order('created_at', { ascending: false });

  if (ctx.visibleCharterIds !== null) {
    vettingQuery = vettingQuery.in('charter_id', ctx.visibleCharterIds);
  }

  const [vettingRes, pendingRes, surveysRes] = await Promise.all([
    vettingQuery,
    supabase
      .from('rlc_candidate_responses')
      .select('id, candidate_name, candidate_office, candidate_state, candidate_district, contact_id, total_score, submitted_at')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('rlc_surveys')
      .select('id, title, state')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ]);

  if (vettingRes.error) throw new Error(`Failed to fetch vettings: ${vettingRes.error.message}`);
  if (pendingRes.error) throw new Error(`Failed to fetch pending submissions: ${pendingRes.error.message}`);
  if (surveysRes.error) throw new Error(`Failed to fetch surveys: ${surveysRes.error.message}`);

  const activeSurveys = (surveysRes.data || []) as { id: string; title: string; state: string | null }[];

  const vettings = (vettingRes.data || []) as VettingRow[];

  // Filter out submissions that already have a vetting.
  // When the user sees all charters (visibleCharterIds === null), the first query
  // already fetched every vetting, so we can reuse those IDs directly.
  let allLinkedIds: Set<string>;
  if (ctx.visibleCharterIds === null) {
    allLinkedIds = new Set(
      vettings.map((v) => v.candidate_response_id).filter(Boolean) as string[]
    );
  } else {
    const { data: allVettingResponseIds, error: linkedIdsError } = await supabase
      .from('rlc_candidate_vettings')
      .select('candidate_response_id');
    if (linkedIdsError) throw new Error(`Failed to fetch linked vetting IDs: ${linkedIdsError.message}`);
    allLinkedIds = new Set(
      (allVettingResponseIds || [])
        .map((v: { candidate_response_id: string | null }) => v.candidate_response_id)
        .filter(Boolean) as string[]
    );
  }

  const pendingSubmissions = ((pendingRes.data || []) as SubmissionRow[]).filter(
    (p) => !allLinkedIds.has(p.id)
  );

  // Build unified pipeline rows: new submissions first, then active vettings
  const submissionRows: PipelineRow[] = pendingSubmissions.map((s) => ({
    id: s.id,
    type: 'submission' as const,
    candidate_name: s.candidate_name,
    candidate_state: s.candidate_state,
    candidate_office: s.candidate_office,
    candidate_district: s.candidate_district,
    contact_id: s.contact_id,
    office_type: null,
    stage: 'submitted',
    total_score: s.total_score,
    recommendation: null,
    date: s.submitted_at ?? '',
    urgency: 'normal' as const,
    election_deadline: null,
  }));

  const vettingRows: PipelineRow[] = vettings.map((v) => ({
    id: v.id,
    type: 'vetting' as const,
    candidate_name: v.candidate_name,
    candidate_state: v.candidate_state,
    candidate_office: v.candidate_office,
    candidate_district: v.candidate_district,
    contact_id: null,
    office_type: v.office_type,
    stage: v.stage,
    total_score: null,
    recommendation: v.recommendation,
    date: v.created_at,
    urgency: calculateUrgency(v.election_deadline?.primary_date ?? null),
    election_deadline: v.election_deadline,
  }));

  return (
    <div>
      <PageHeader
        title="Candidate Pipeline"
        count={vettingRows.length + submissionRows.length}
        className="mb-8"
        action={<AddCandidateDialog surveys={activeSurveys} />}
      />

      {/* Section 1: In Progress */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          In Progress ({vettingRows.length})
        </h2>
        <PipelineTable rows={vettingRows} canCreate={canCreate} emptyMessage="No active vettings yet. Add candidates from the submissions below." />
      </div>

      {/* Section 2: New Submissions */}
      {(submissionRows.length > 0 || canCreate) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            New Submissions ({submissionRows.length})
          </h2>
          <PipelineTable rows={submissionRows} canCreate={canCreate} emptyMessage="No pending questionnaire submissions." />
        </div>
      )}
    </div>
  );
}
