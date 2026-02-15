import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline, canCreateVetting } from '@/lib/vetting/permissions';
import { calculateUrgency } from '@/lib/vetting/engine';
import { PageHeader } from '@/components/ui/page-header';
import { PipelineTable } from '@/components/admin/vetting/pipeline-table';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';
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

  const [vettingRes, pendingRes] = await Promise.all([
    vettingQuery,
    supabase
      .from('rlc_candidate_responses')
      .select('id, candidate_name, candidate_office, candidate_state, candidate_district, total_score, submitted_at')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false }),
  ]);

  if (vettingRes.error) throw new Error(`Failed to fetch vettings: ${vettingRes.error.message}`);
  if (pendingRes.error) throw new Error(`Failed to fetch pending submissions: ${pendingRes.error.message}`);

  const vettings = (vettingRes.data || []) as VettingRow[];

  // Filter out submissions that already have a vetting
  const { data: allVettingResponseIds, error: linkedIdsError } = await supabase
    .from('rlc_candidate_vettings')
    .select('candidate_response_id');

  if (linkedIdsError) throw new Error(`Failed to fetch linked vetting IDs: ${linkedIdsError.message}`);

  const allLinkedIds = new Set(
    (allVettingResponseIds || [])
      .map((v: { candidate_response_id: string | null }) => v.candidate_response_id)
      .filter(Boolean)
  );

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
    office_type: v.office_type,
    stage: v.stage,
    total_score: null,
    recommendation: v.recommendation,
    date: v.created_at,
    urgency: calculateUrgency(v.election_deadline?.primary_date ?? null),
    election_deadline: v.election_deadline,
  }));

  const rows = [...submissionRows, ...vettingRows];

  // Summary counts
  const newCount = submissionRows.length;
  const activeCount = vettingRows.length;
  const totalCount = rows.length;

  return (
    <div>
      <PageHeader
        title="Candidate Pipeline"
        count={totalCount}
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

      {/* Summary bar */}
      {totalCount > 0 && (
        <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
          {newCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              {newCount} new {newCount === 1 ? 'submission' : 'submissions'}
            </span>
          )}
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              {activeCount} in progress
            </span>
          )}
        </div>
      )}

      <PipelineTable rows={rows} canCreate={canCreate} />
    </div>
  );
}
