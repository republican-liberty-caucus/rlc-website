import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline } from '@/lib/vetting/permissions';
import { calculateUrgency, calculateVettingProgress, STAGE_ORDER } from '@/lib/vetting/engine';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import type { VettingStage, VettingSectionStatus, VettingReportSectionType } from '@/types';

export const metadata: Metadata = {
  title: 'Vetting Detail - Admin',
  description: 'Candidate vetting detail view',
};

interface VettingDetailRow {
  id: string;
  candidate_response_id: string;
  candidate_name: string;
  candidate_state: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  candidate_party: string | null;
  stage: VettingStage;
  recommendation: string | null;
  recommendation_notes: string | null;
  interview_date: string | null;
  created_at: string;
  updated_at: string;
  election_deadline: {
    primary_date: string | null;
    general_date: string | null;
    state_code: string | null;
    cycle_year: number | null;
    office_type: string | null;
  } | null;
  committee: {
    id: string;
    name: string;
  } | null;
}

interface SectionRow {
  id: string;
  section: VettingReportSectionType;
  status: VettingSectionStatus;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Convert snake_case to Title Case (e.g. "auto_audit" -> "Auto Audit") */
function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const sectionStatusIcon: Record<VettingSectionStatus, string> = {
  section_not_started: '\u25CB',  // empty circle
  section_assigned: '\u25D4',     // half circle
  section_in_progress: '\u25D4',  // half circle
  section_completed: '\u25CF',    // filled circle
  needs_revision: '\u25CE',       // bullseye
};

const sectionStatusColor: Record<VettingSectionStatus, string> = {
  section_not_started: 'text-muted-foreground',
  section_assigned: 'text-blue-500',
  section_in_progress: 'text-amber-500',
  section_completed: 'text-green-500',
  needs_revision: 'text-red-500',
};

export default async function VettingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getVettingContext(userId);
  if (!ctx || !canViewPipeline(ctx)) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  // Fetch vetting with related data
  const { data, error } = await supabase
    .from('rlc_candidate_vettings')
    .select(`
      id, candidate_response_id, candidate_name, candidate_state, candidate_office,
      candidate_district, candidate_party, stage, recommendation, recommendation_notes,
      interview_date, created_at, updated_at,
      election_deadline:rlc_candidate_election_deadlines(primary_date, general_date, state_code, cycle_year, office_type),
      committee:rlc_candidate_vetting_committees(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') notFound();
    throw new Error(`Failed to fetch vetting ${id}: ${error.message}`);
  }
  if (!data) notFound();

  const vetting = data as unknown as VettingDetailRow;

  // Fetch report sections
  const { data: sections, error: sectionsError } = await supabase
    .from('rlc_candidate_vetting_report_sections')
    .select('id, section, status')
    .eq('vetting_id', id)
    .order('created_at', { ascending: true });

  if (sectionsError) {
    throw new Error(`Failed to fetch report sections for vetting ${id}: ${sectionsError.message}`);
  }

  const sectionRows = (sections ?? []) as SectionRow[];

  const progress = calculateVettingProgress(sectionRows);
  const urgency = calculateUrgency(vetting.election_deadline?.primary_date ?? null);
  const stageIndex = STAGE_ORDER.indexOf(vetting.stage);

  return (
    <div>
      <PageHeader
        title={vetting.candidate_name}
        className="mb-8"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content area */}
        <div className="space-y-6 lg:col-span-2">
          {/* Candidate info card */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{vetting.candidate_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {[vetting.candidate_party, vetting.candidate_office, vetting.candidate_district]
                    .filter(Boolean)
                    .join(' \u2022 ') || 'No details yet'}
                </p>
                {vetting.candidate_state && (
                  <p className="mt-1 text-sm text-muted-foreground">{vetting.candidate_state}</p>
                )}
              </div>
              <StatusBadge status={vetting.stage} type="vetting" />
            </div>

            {/* Stage progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {STAGE_ORDER.map((stage, i) => (
                  <span
                    key={stage}
                    className={
                      i <= stageIndex
                        ? 'font-medium text-foreground'
                        : ''
                    }
                  >
                    {formatLabel(stage)}
                  </span>
                ))}
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${((stageIndex + 1) / STAGE_ORDER.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Key details */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Details
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Committee</dt>
                <dd className="text-sm font-medium">
                  {vetting.committee?.name ?? 'Not assigned'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Primary Date</dt>
                <dd className="text-sm font-medium">
                  {vetting.election_deadline?.primary_date
                    ? formatDate(vetting.election_deadline.primary_date)
                    : 'Not set'}
                  {urgency !== 'normal' && (
                    <span className={`ml-2 text-xs font-semibold ${
                      urgency === 'red'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {urgency === 'red' ? 'URGENT' : 'APPROACHING'}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">General Date</dt>
                <dd className="text-sm font-medium">
                  {vetting.election_deadline?.general_date
                    ? formatDate(vetting.election_deadline.general_date)
                    : 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Recommendation</dt>
                <dd className="text-sm font-medium">
                  {vetting.recommendation
                    ? formatLabel(vetting.recommendation)
                    : 'Pending'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Interview</dt>
                <dd className="text-sm font-medium">
                  {vetting.interview_date
                    ? formatDate(vetting.interview_date)
                    : 'Not scheduled'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Created</dt>
                <dd className="text-sm font-medium">{formatDate(vetting.created_at)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Sidebar: Section progress */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Report Progress
            </h3>
            <p className="mb-4 text-2xl font-bold">
              {progress.percentage}%
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({progress.completed}/{progress.total} sections)
              </span>
            </p>

            <div className="mb-4 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-green-500 transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <ul className="space-y-2">
              {sectionRows.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className={sectionStatusColor[s.status]}>
                    {sectionStatusIcon[s.status]}
                  </span>
                  <span className={s.status === 'section_completed' ? 'text-foreground' : 'text-muted-foreground'}>
                    {formatLabel(s.section)}
                  </span>
                </li>
              ))}
              {sectionRows.length === 0 && (
                <li className="text-sm text-muted-foreground">No sections initialized</li>
              )}
            </ul>
          </div>

          <Link
            href="/admin/vetting"
            className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to Pipeline
          </Link>
        </div>
      </div>
    </div>
  );
}
