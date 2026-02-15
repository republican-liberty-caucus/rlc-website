import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate, formatCandidateName } from '@/lib/utils';

interface SurveyResultsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SurveyResultsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from('rlc_surveys').select('title, description').eq('slug', slug).single();
  const survey = data as { title: string; description: string | null } | null;
  return {
    title: survey ? `${survey.title} - Candidate Survey Results` : 'Survey Results',
    description: survey?.description || 'Candidate endorsement survey results from the Republican Liberty Caucus.',
  };
}

export default async function SurveyResultsPage({ params }: SurveyResultsPageProps) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: surveyData, error: surveyError } = await supabase
    .from('rlc_surveys')
    .select('*')
    .eq('slug', slug)
    .in('status', ['active', 'closed'])
    .single();

  if (surveyError || !surveyData) notFound();

  const survey = surveyData as {
    id: string; title: string; description: string | null; status: string;
    election_type: string | null; election_date: string | null; state: string | null;
  };

  // Get submitted candidates with scores
  const { data: candidatesData } = await supabase
    .from('rlc_candidate_responses')
    .select('id, candidate_first_name, candidate_last_name, candidate_party, candidate_office, candidate_district, candidate_state, status, total_score, submitted_at, office_type:rlc_office_types(name, district_label)')
    .eq('survey_id', survey.id)
    .in('status', ['submitted', 'endorsed', 'not_endorsed'])
    .order('total_score', { ascending: false, nullsFirst: false });

  const candidates = (candidatesData || []) as {
    id: string; candidate_first_name: string; candidate_last_name: string; candidate_party: string | null;
    candidate_office: string | null; candidate_district: string | null;
    candidate_state: string | null;
    office_type: { name: string; district_label: string | null } | null;
    status: string; total_score: number | null; submitted_at: string | null;
  }[];

  function getScoreColor(score: number | null): string {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-blue to-rlc-blue/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Link href="/candidate-surveys" className="text-sm text-white/70 hover:text-white">
            &larr; All Surveys
          </Link>
          <h1 className="mt-4 text-2xl font-bold sm:text-3xl md:text-4xl">{survey.title}</h1>
          {survey.description && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">{survey.description}</p>
          )}
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-white/70">
            {survey.election_type && <span className="capitalize">{survey.election_type}</span>}
            {survey.state && <span>{survey.state}</span>}
            {survey.election_date && <span>{formatDate(survey.election_date)}</span>}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          {candidates.length > 0 ? (
            <div className="mx-auto max-w-3xl">
              <h2 className="mb-6 text-2xl font-bold">Results</h2>
              <div className="space-y-4">
                {candidates.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-4 rounded-lg border bg-card p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{formatCandidateName(c.candidate_first_name, c.candidate_last_name)}</p>
                        {c.candidate_party && (
                          <span className="text-xs text-muted-foreground">({c.candidate_party})</span>
                        )}
                        {c.status === 'endorsed' && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            RLC Endorsed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.office_type?.name ?? c.candidate_office ?? 'Office not specified'}
                        {c.candidate_state ? ` - ${c.candidate_state}` : ''}
                        {c.candidate_district
                          ? ` ${c.office_type?.district_label ?? 'District'} ${c.candidate_district}`
                          : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getScoreColor(c.total_score)}`}>
                        {c.total_score !== null ? `${Math.round(c.total_score)}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">Liberty Score</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-center text-sm text-muted-foreground">
                Scores are calculated based on alignment with RLC principles of individual liberty,
                limited government, and free markets. Higher scores indicate stronger alignment.
              </p>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground">
                {survey.status === 'active'
                  ? 'Results will be published as candidates complete the survey.'
                  : 'No candidate responses available for this survey.'}
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
