import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatCandidateName } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { VettingSurveyTab } from '@/components/admin/vetting/tabs/vetting-survey-tab';
import type { SurveyResponseData, SurveyAnswerData } from '@/components/admin/vetting/types';

interface CandidateDetailPageProps {
  params: Promise<{ id: string; candidateId: string }>;
}

export async function generateMetadata({ params }: CandidateDetailPageProps): Promise<Metadata> {
  const { candidateId } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_candidate_responses')
    .select('candidate_first_name, candidate_last_name')
    .eq('id', candidateId)
    .single();
  const candidate = data as { candidate_first_name: string; candidate_last_name: string } | null;
  return { title: candidate ? `${formatCandidateName(candidate.candidate_first_name, candidate.candidate_last_name)} - Survey Response` : 'Candidate Detail' };
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id: surveyId, candidateId } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  // Fetch candidate response with survey info
  const { data: responseData, error: responseError } = await supabase
    .from('rlc_candidate_responses')
    .select(`
      id, candidate_first_name, candidate_last_name, candidate_email, candidate_party, candidate_office,
      candidate_district, candidate_state, candidate_county, contact_id,
      total_score, status, submitted_at, created_at,
      contact:rlc_contacts(id, first_name, last_name, email, membership_status),
      office_type:rlc_office_types(name, district_label),
      survey:rlc_surveys(id, title, election_type, election_date, state)
    `)
    .eq('id', candidateId)
    .eq('survey_id', surveyId)
    .single();

  if (responseError || !responseData) notFound();

  const response = responseData as unknown as {
    id: string; candidate_first_name: string; candidate_last_name: string; candidate_email: string | null;
    candidate_party: string | null; candidate_office: string | null;
    candidate_district: string | null; candidate_state: string | null;
    candidate_county: string | null; contact_id: string | null;
    contact: { id: string; first_name: string; last_name: string; email: string | null; membership_status: string } | null;
    total_score: number | null;
    status: string; submitted_at: string | null; created_at: string;
    office_type: { name: string; district_label: string | null } | null;
    survey: { id: string; title: string; election_type: string | null; election_date: string | null; state: string | null } | null;
  };

  // Fetch survey answers
  const { data: answersData } = await supabase
    .from('rlc_survey_answers')
    .select(`
      id, answer, score,
      question:rlc_survey_questions(question_text, question_type, options, weight, sort_order, ideal_answer)
    `)
    .eq('candidate_response_id', candidateId);

  const sortedAnswers = ((answersData ?? []) as unknown as SurveyAnswerData[])
    .sort((a, b) => a.question.sort_order - b.question.sort_order);

  // Build SurveyResponseData to reuse VettingSurveyTab
  const surveyResponse: SurveyResponseData = {
    id: response.id,
    candidate_first_name: response.candidate_first_name,
    candidate_last_name: response.candidate_last_name,
    candidate_email: response.candidate_email,
    candidate_party: response.candidate_party,
    candidate_office: response.candidate_office,
    candidate_district: response.candidate_district,
    contact_id: response.contact_id,
    contact: response.contact,
    total_score: response.total_score,
    status: response.status,
    submitted_at: response.submitted_at,
    created_at: response.created_at,
    survey: response.survey,
    answers: sortedAnswers,
  };

  // Build office display
  const officeName = response.office_type?.name ?? response.candidate_office ?? 'Unknown Office';
  const parts = [officeName];
  if (response.candidate_state) parts.push(response.candidate_state);
  if (response.candidate_district) {
    const label = response.office_type?.district_label ?? 'District';
    parts.push(`${label} ${response.candidate_district}`);
  }
  const officeDisplay = parts.join(' - ');

  return (
    <div>
      <div className="mb-8">
        <Link href={`/admin/surveys/${surveyId}`} className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Survey
        </Link>
        <PageHeader
          title={formatCandidateName(response.candidate_first_name, response.candidate_last_name)}
          className="mt-2"
        />
        <p className="text-muted-foreground">{officeDisplay}</p>
      </div>

      <VettingSurveyTab surveyResponse={surveyResponse} />
    </div>
  );
}
