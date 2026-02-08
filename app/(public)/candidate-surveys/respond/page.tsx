import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { CandidateSurveyForm } from '@/components/surveys/candidate-survey-form';

export const metadata: Metadata = {
  title: 'Complete Survey - RLC',
  description: 'Complete your Republican Liberty Caucus candidate survey.',
};

interface RespondPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function CandidateRespondPage({ searchParams }: RespondPageProps) {
  const { token } = await searchParams;

  if (!token) notFound();

  const supabase = createServerClient();

  // Find the candidate response and survey
  const { data: responseData, error: responseError } = await supabase
    .from('rlc_candidate_responses')
    .select('id, survey_id, candidate_name, status, token_expires_at')
    .eq('access_token', token)
    .single();

  if (responseError || !responseData) notFound();

  const candidateResponse = responseData as {
    id: string; survey_id: string; candidate_name: string; status: string;
    token_expires_at: string | null;
  };

  // Check token expiration (issue #55)
  if (candidateResponse.token_expires_at && new Date(candidateResponse.token_expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen flex-col">
        <MainNav />
        <section className="flex flex-1 items-center justify-center py-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Survey Link Expired</h1>
            <p className="mt-4 text-muted-foreground">
              This survey link has expired. Please contact the RLC for a new link.
            </p>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  if (candidateResponse.status === 'submitted') {
    return (
      <div className="flex min-h-screen flex-col">
        <MainNav />
        <section className="flex flex-1 items-center justify-center py-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Survey Already Submitted</h1>
            <p className="mt-4 text-muted-foreground">
              Thank you, {candidateResponse.candidate_name}. Your survey response has already been recorded.
            </p>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  // Get survey details and questions
  const { data: surveyData, error: surveyError } = await supabase
    .from('rlc_surveys')
    .select('id, title, description, status')
    .eq('id', candidateResponse.survey_id)
    .single();

  if (surveyError || !surveyData) notFound();

  const survey = surveyData as { id: string; title: string; description: string | null; status: string };

  if (survey.status !== 'active') {
    return (
      <div className="flex min-h-screen flex-col">
        <MainNav />
        <section className="flex flex-1 items-center justify-center py-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Survey Closed</h1>
            <p className="mt-4 text-muted-foreground">
              This survey is no longer accepting responses.
            </p>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const { data: questionsData } = await supabase
    .from('rlc_survey_questions')
    .select('id, question_text, question_type, options, sort_order')
    .eq('survey_id', survey.id)
    .order('sort_order');

  const questions = (questionsData || []) as {
    id: string; question_text: string; question_type: string;
    options: string[]; sort_order: number;
  }[];

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-12 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold">{survey.title}</h1>
          {survey.description && (
            <p className="mx-auto mt-3 max-w-2xl text-white/90">{survey.description}</p>
          )}
          <p className="mt-3 text-sm text-white/70">
            Completing this survey for: <strong>{candidateResponse.candidate_name}</strong>
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <CandidateSurveyForm
              accessToken={token}
              questions={questions}
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
