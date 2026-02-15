import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline } from '@/lib/vetting/permissions';
import { VettingReportView } from '@/components/admin/vetting/report/vetting-report-view';
import type { VettingReportSectionType, VettingRecommendation, BoardVoteChoice } from '@/types';

export const metadata: Metadata = {
  title: 'Vetting Report - Admin',
  description: 'Candidate vetting report preview',
};

export default async function VettingReportPage({
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

  // Fetch vetting with all related data
  const { data, error } = await supabase
    .from('rlc_candidate_vettings')
    .select(`
      *,
      office_type:rlc_office_types(name, district_label),
      election_deadline:rlc_candidate_election_deadlines(id, primary_date, general_date, state_code, cycle_year, office_type),
      committee:rlc_candidate_vetting_committees(id, name),
      report_sections:rlc_candidate_vetting_report_sections(section, data, status),
      opponents:rlc_candidate_vetting_opponents(name, party, is_incumbent, background, credibility, fundraising, endorsements, social_links, photo_url)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') notFound();
    throw new Error(`Failed to fetch vetting ${id}: ${error.message}`);
  }
  if (!data) notFound();

  // Cast through unknown — Supabase generated types don't include vetting tables
  const vetting = data as unknown as Record<string, unknown>;

  // Fetch board votes with voter names
  const { data: votes } = await supabase
    .from('rlc_candidate_vetting_board_votes')
    .select('vote, notes, voter:rlc_contacts!voter_id(first_name, last_name)')
    .eq('vetting_id', id)
    .order('voted_at', { ascending: true });

  type VoteRow = { vote: string; notes: string | null; voter: { first_name: string; last_name: string } | null };
  const voteSummaries = ((votes ?? []) as unknown as VoteRow[]).map((v) => ({
    voter_name: v.voter ? `${v.voter.first_name} ${v.voter.last_name}` : 'Unknown',
    vote: v.vote as BoardVoteChoice,
    notes: v.notes,
  }));

  const reportData = {
    id: vetting.id as string,
    candidate_first_name: vetting.candidate_first_name as string,
    candidate_last_name: vetting.candidate_last_name as string,
    candidate_state: vetting.candidate_state as string | null,
    candidate_office: vetting.candidate_office as string | null,
    candidate_district: vetting.candidate_district as string | null,
    candidate_party: vetting.candidate_party as string | null,
    office_type: vetting.office_type as { name: string; district_label: string | null } | null,
    stage: vetting.stage as string,
    recommendation: vetting.recommendation as VettingRecommendation | null,
    recommendation_notes: vetting.recommendation_notes as string | null,
    endorsement_result: vetting.endorsement_result as VettingRecommendation | null,
    endorsed_at: vetting.endorsed_at as string | null,
    interview_date: vetting.interview_date as string | null,
    interview_notes: vetting.interview_notes as string | null,
    interviewers: vetting.interviewers as string[] | null,
    created_at: vetting.created_at as string,
    election_deadline: vetting.election_deadline as {
      primary_date: string | null;
      general_date: string | null;
      state_code: string | null;
      cycle_year: number | null;
      office_type: string | null;
    } | null,
    committee: vetting.committee as { name: string } | null,
    sections: ((vetting.report_sections ?? []) as unknown as {
      section: VettingReportSectionType;
      data: Record<string, unknown> | null;
      status: string;
    }[]),
    opponents: ((vetting.opponents ?? []) as unknown as {
      name: string;
      party: string | null;
      is_incumbent: boolean;
      background: string | null;
      credibility: string | null;
      fundraising: Record<string, unknown> | null;
      endorsements: string[];
      social_links: Record<string, unknown> | null;
      photo_url: string | null;
    }[]),
    votes: voteSummaries,
  };

  return (
    <div className="print:p-0">
      <VettingReportView data={reportData} />
    </div>
  );
}
