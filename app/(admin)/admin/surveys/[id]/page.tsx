import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { formatDate } from '@/lib/utils';
import { SurveyManagement } from '@/components/admin/survey-management';

interface SurveyDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SurveyDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from('rlc_surveys').select('title').eq('id', id).single();
  const survey = data as { title: string } | null;
  return { title: survey ? `${survey.title} - Admin` : 'Survey - Admin' };
}

export default async function AdminSurveyDetailPage({ params }: SurveyDetailPageProps) {
  const { supabase } = await requireAdmin();

  const { id } = await params;

  const { data: surveyData, error: surveyError } = await supabase
    .from('rlc_surveys')
    .select('*')
    .eq('id', id)
    .single();

  if (surveyError || !surveyData) notFound();

  const survey = surveyData as {
    id: string; title: string; slug: string; description: string | null;
    status: string; election_type: string | null; primary_date: string | null;
    general_date: string | null; state: string | null; charter_id: string | null;
    created_at: string;
  };

  const [questionsResult, candidatesResult] = await Promise.all([
    supabase.from('rlc_survey_questions')
      .select('id, question_text, question_type, weight, sort_order')
      .eq('survey_id', id)
      .order('sort_order'),
    supabase.from('rlc_candidate_responses')
      .select('id, candidate_first_name, candidate_last_name, candidate_email, candidate_office, candidate_district, candidate_state, candidate_county, status, total_score, access_token, submitted_at, created_at, office_type:rlc_office_types(name, district_label)')
      .eq('survey_id', id)
      .order('candidate_last_name'),
  ]);

  const questions = (questionsResult.data || []) as {
    id: string; question_text: string; question_type: string; weight: number; sort_order: number;
  }[];

  const candidates = (candidatesResult.data || []) as {
    id: string; candidate_first_name: string; candidate_last_name: string; candidate_email: string | null;
    candidate_office: string | null; candidate_district: string | null;
    candidate_state: string | null; candidate_county: string | null;
    office_type: { name: string; district_label: string | null } | null;
    status: string; total_score: number | null; access_token: string;
    submitted_at: string | null; created_at: string;
  }[];

  // Fetch existing vettings for these candidates to show Start Vetting / View Pipeline
  const candidateIds = candidates.map((c) => c.id);
  const vettingMap: Record<string, string> = {};
  if (candidateIds.length > 0) {
    const { data: vettings } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, candidate_response_id')
      .in('candidate_response_id', candidateIds);
    for (const v of (vettings ?? []) as { id: string; candidate_response_id: string }[]) {
      vettingMap[v.candidate_response_id] = v.id;
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/surveys" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Surveys
        </Link>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{survey.title}</h1>
            <p className="mt-1 text-muted-foreground">
              {survey.election_type && <span className="capitalize">{survey.election_type} </span>}
              {survey.state && <span>{survey.state} </span>}
              {survey.primary_date && <span>| Primary: {formatDate(survey.primary_date)} </span>}
              {survey.general_date && <span>| General: {formatDate(survey.general_date)} </span>}
              | {questions.length} questions | {candidates.length} candidates
            </p>
          </div>
          <span className={`self-start rounded-full px-3 py-1 text-sm font-medium capitalize ${
            survey.status === 'active' ? 'bg-green-100 text-green-800' :
            survey.status === 'closed' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {survey.status}
          </span>
        </div>
      </div>

      <SurveyManagement
        surveyId={survey.id}
        surveyStatus={survey.status}
        charterId={survey.charter_id}
        candidates={candidates}
        vettingMap={vettingMap}
      />
    </div>
  );
}
