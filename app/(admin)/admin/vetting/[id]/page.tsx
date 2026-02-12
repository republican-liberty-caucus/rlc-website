import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
  getVettingContext,
  canViewPipeline,
  canCreateVetting,
  canAssignSections,
  canRecordInterview,
  canMakeRecommendation,
  canCastBoardVote,
} from '@/lib/vetting/permissions';
import { calculateVettingProgress } from '@/lib/vetting/engine';
import { PageHeader } from '@/components/ui/page-header';
import { VettingDetailTabs } from '@/components/admin/vetting/vetting-detail-tabs';
import type {
  VettingFullData,
  VettingPermissions,
  ReportSectionWithAssignments,
  CommitteeMemberOption,
} from '@/components/admin/vetting/types';
import type { VettingSectionStatus } from '@/types';

export const metadata: Metadata = {
  title: 'Vetting Detail - Admin',
  description: 'Candidate vetting detail view',
};

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const sectionStatusIcon: Record<VettingSectionStatus, string> = {
  section_not_started: '\u25CB',
  section_assigned: '\u25D4',
  section_in_progress: '\u25D4',
  section_completed: '\u25CF',
  needs_revision: '\u25CE',
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

  // Fetch vetting with all related data including sections+assignments+opponents
  const { data, error } = await supabase
    .from('rlc_candidate_vettings')
    .select(`
      *,
      election_deadline:rlc_candidate_election_deadlines(id, primary_date, general_date, state_code, cycle_year, office_type),
      committee:rlc_candidate_vetting_committees(id, name),
      report_sections:rlc_candidate_vetting_report_sections(
        *,
        assignments:rlc_candidate_vetting_section_assignments(
          *,
          committee_member:rlc_candidate_vetting_committee_members(
            id, role, contact:rlc_members(id, first_name, last_name, email)
          )
        )
      ),
      opponents:rlc_candidate_vetting_opponents(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') notFound();
    throw new Error(`Failed to fetch vetting ${id}: ${error.message}`);
  }
  if (!data) notFound();

  const vetting = data as unknown as VettingFullData;
  const sections = (vetting.report_sections ?? []) as ReportSectionWithAssignments[];
  const progress = calculateVettingProgress(sections);

  // Fetch committee members for assignment dropdowns
  let committeeMembers: CommitteeMemberOption[] = [];
  if (vetting.committee?.id) {
    const { data: members, error: membersError } = await supabase
      .from('rlc_candidate_vetting_committee_members')
      .select('id, contact_id, role, is_active, contact:rlc_members(id, first_name, last_name, email)')
      .eq('committee_id', vetting.committee.id)
      .eq('is_active', true);

    if (membersError) {
      logger.error('Failed to fetch committee members:', { committeeId: vetting.committee.id, error: membersError });
    }

    committeeMembers = (members ?? []) as unknown as CommitteeMemberOption[];
  }

  // Build serializable permissions object
  const permissions: VettingPermissions = {
    canCreateVetting: canCreateVetting(ctx),
    canAssignSections: canAssignSections(ctx),
    canEditAnySection: ctx.isChair || ctx.isNational,
    canRecordInterview: canRecordInterview(ctx),
    canMakeRecommendation: canMakeRecommendation(ctx),
    canCastBoardVote: canCastBoardVote(ctx),
    isCommitteeMember: ctx.isCommitteeMember,
    isChair: ctx.isChair,
    isNational: ctx.isNational,
    committeeMemberId: ctx.committeeMemberId,
  };

  return (
    <div>
      <PageHeader
        title={vetting.candidate_name}
        className="mb-8"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content area with tabs */}
        <div className="lg:col-span-2">
          <VettingDetailTabs
            vetting={vetting}
            permissions={permissions}
            committeeMembers={committeeMembers}
          />
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
              {sections.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className={sectionStatusColor[s.status]}>
                    {sectionStatusIcon[s.status]}
                  </span>
                  <span className={s.status === 'section_completed' ? 'text-foreground' : 'text-muted-foreground'}>
                    {formatLabel(s.section)}
                  </span>
                  {s.assignments.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({s.assignments.length} assigned)
                    </span>
                  )}
                </li>
              ))}
              {sections.length === 0 && (
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
