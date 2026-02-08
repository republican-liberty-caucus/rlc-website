import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Target } from 'lucide-react';
import type { ScorecardSession } from '@/types';

export const metadata: Metadata = {
  title: 'Liberty Scorecards',
  description: 'See how your legislators vote on liberty issues. The RLC Liberty Scorecard ranks elected officials based on their voting records.',
};

export default async function ScorecardsPage() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('rlc_scorecard_sessions')
    .select('id, name, slug, jurisdiction, state_code, session_year, status')
    .in('status', ['active', 'published'])
    .order('session_year', { ascending: false });

  const sessions = (data || []) as ScorecardSession[];

  const federal = sessions.filter((s) => s.jurisdiction === 'federal');
  const state = sessions.filter((s) => s.jurisdiction === 'state');

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-blue to-rlc-blue/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Liberty Scorecards</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            How do your representatives vote on liberty? Our scorecards track legislators&apos; voting
            records on issues that matter: limited government, individual liberty, and free markets.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          {federal.length > 0 && (
            <div className="mb-12">
              <h2 className="mb-6 text-2xl font-bold">Federal Scorecards</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {federal.map((session) => (
                  <ScorecardCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {state.length > 0 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold">State Scorecards</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {state.map((session) => (
                  <ScorecardCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <EmptyState
              icon={<Target className="h-12 w-12" />}
              title="Scorecards Coming Soon"
              description="We're preparing Liberty Scorecards for this session. In the meantime, contact your reps directly."
              action={{ label: 'Find Your Reps', href: '/action-center' }}
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function ScorecardCard({ session }: { session: ScorecardSession }) {
  return (
    <Link
      href={`/scorecards/${session.slug}`}
      className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          session.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {session.status === 'active' ? 'In Progress' : 'Published'}
        </span>
        {session.state_code && (
          <span className="text-xs text-muted-foreground">{session.state_code}</span>
        )}
      </div>
      <h3 className="text-lg font-semibold">{session.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {session.jurisdiction === 'federal' ? 'Federal' : session.state_code} | {session.session_year}
      </p>
    </Link>
  );
}
