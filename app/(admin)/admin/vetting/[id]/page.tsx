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
  SurveyResponseData,
  SurveyAnswerData,
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

  // Fetch survey response with individual answers
  let surveyResponse: SurveyResponseData | null = null;
  if (vetting.candidate_response_id) {
    const { data: response, error: responseError } = await supabase
      .from('rlc_candidate_responses')
      .select(`
        id, candidate_name, candidate_email, candidate_party, candidate_office,
        candidate_district, total_score, status, submitted_at, created_at,
        survey:rlc_surveys(title, election_type, election_date, state)
      `)
      .eq('id', vetting.candidate_response_id)
      .single();

    if (responseError) {
      logger.error('Failed to fetch survey response:', { responseId: vetting.candidate_response_id, error: responseError });
    }

    if (response) {
      const { data: answers, error: answersError } = await supabase
        .from('rlc_survey_answers')
        .select(`
          id, answer, score,
          question:rlc_survey_questions(question_text, question_type, options, weight, sort_order, ideal_answer)
        `)
        .eq('candidate_response_id', vetting.candidate_response_id);

      if (answersError) {
        logger.error('Failed to fetch survey answers:', { responseId: vetting.candidate_response_id, error: answersError });
      }

      const sortedAnswers = ((answers ?? []) as unknown as SurveyAnswerData[])
        .sort((a, b) => a.question.sort_order - b.question.sort_order);

      surveyResponse = {
        ...(response as unknown as Omit<SurveyResponseData, 'answers'>),
        answers: sortedAnswers,
      };
    }
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
            surveyResponse={surveyResponse}
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
            href={`/admin/vetting/${id}/report`}
            className="block rounded-lg border bg-rlc-red text-white text-center text-sm font-medium py-2 px-4 hover:bg-rlc-red/90 transition-colors"
          >
            View Full Report
          </Link>

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
