import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Candidate Surveys',
  description: 'Republican Liberty Caucus candidate endorsement survey results.',
};

interface SurveyRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  election_type: string | null;
  election_date: string | null;
  state: string | null;
  description: string | null;
}

export default async function CandidateSurveysPage() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('rlc_surveys')
    .select('id, title, slug, status, election_type, election_date, state, description')
    .in('status', ['active', 'closed'])
    .order('created_at', { ascending: false });

  const surveys = (data || []) as SurveyRow[];

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-blue to-rlc-blue/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Candidate Endorsement Surveys</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            See how candidates align with the principles of individual liberty, limited government,
            and free markets.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          {surveys.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {surveys.map((survey) => (
                <Link
                  key={survey.id}
                  href={`/candidate-surveys/${survey.slug}`}
                  className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      survey.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {survey.status === 'active' ? 'Active' : 'Completed'}
                    </span>
                    {survey.state && (
                      <span className="text-xs text-muted-foreground">{survey.state}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">{survey.title}</h3>
                  {survey.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {survey.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    {survey.election_type && (
                      <span className="capitalize">{survey.election_type}</span>
                    )}
                    {survey.election_date && (
                      <span>{formatDate(survey.election_date)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ClipboardList className="h-12 w-12" />}
              title="No Active Surveys"
              description="Candidate surveys are published during election season. Check back closer to election time."
              action={{ label: 'View Scorecards', href: '/scorecards' }}
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
