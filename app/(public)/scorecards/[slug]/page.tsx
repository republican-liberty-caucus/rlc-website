import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { LegislatorTable } from '@/components/scorecards/legislator-table';
import { ShareButtons } from '@/components/shared/share-buttons';
import { ScorecardTabs } from '@/components/scorecards/scorecard-tabs';
import { ScorecardOverview } from '@/components/scorecards/scorecard-overview';
import { TopDefenders } from '@/components/scorecards/top-defenders';
import { BillExplanations } from '@/components/scorecards/bill-explanations';
import { VoteMatrix } from '@/components/scorecards/vote-matrix';
import type { ScorecardSession, ScorecardBill, ScorecardVote, Legislator } from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_scorecard_sessions')
    .select('name, description')
    .eq('slug', slug)
    .single();

  const session = data as { name: string; description: string | null } | null;
  return {
    title: session ? `${session.name} - Liberty Scorecard` : 'Liberty Scorecard',
    description: session?.description
      ? session.description.slice(0, 160)
      : session
        ? `See how legislators scored on the ${session.name} Liberty Scorecard.`
        : 'Liberty Scorecard results',
  };
}

export default async function ScorecardDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  // Fetch session
  const { data: sessionData, error: sessionError } = await supabase
    .from('rlc_scorecard_sessions')
    .select('*')
    .eq('slug', slug)
    .in('status', ['active', 'published'])
    .single();

  if (sessionError || !sessionData) notFound();
  const session = sessionData as ScorecardSession;

  const { data: billsData, error: billsError } = await supabase
    .from('rlc_scorecard_bills')
    .select('*')
    .eq('session_id', session.id)
    .eq('bill_status', 'voted')
    .order('sort_order', { ascending: true });

  if (billsError) throw new Error('Unable to load scorecard bills.');
  const bills = (billsData ?? []) as ScorecardBill[];
  const billIds = bills.map((b) => b.id);
  const weightMap = new Map<string, number>();
  for (const b of bills) {
    weightMap.set(b.id, Number(b.weight) || 1);
  }

  // Fetch ALL votes (full records for the matrix)
  let allVotes: ScorecardVote[] = [];
  let legislators: (Legislator & { computed_score: number | null })[] = [];

  if (billIds.length > 0) {
    const { data: votesData, error: votesError } = await supabase
      .from('rlc_scorecard_votes')
      .select('*')
      .in('bill_id', billIds);

    if (votesError) throw new Error('Unable to load scorecard votes.');
    allVotes = (votesData ?? []) as ScorecardVote[];

    // Compute scores per legislator
    const scores = new Map<string, { weightedSum: number; totalWeight: number }>();
    for (const vote of allVotes) {
      const current = scores.get(vote.legislator_id) || { weightedSum: 0, totalWeight: 0 };
      const weight = weightMap.get(vote.bill_id) || 1;
      current.totalWeight += weight;
      if (vote.aligned_with_liberty) current.weightedSum += weight;
      scores.set(vote.legislator_id, current);
    }

    const legislatorIds = Array.from(scores.keys());
    if (legislatorIds.length > 0) {
      const { data: legData, error: legError } = await supabase
        .from('rlc_legislators')
        .select('*')
        .in('id', legislatorIds);

      if (legError) throw new Error('Unable to load legislator data.');
      legislators = ((legData ?? []) as Legislator[]).map((leg) => {
        const s = scores.get(leg.id);
        const score = s && s.totalWeight > 0
          ? Math.round((s.weightedSum / s.totalWeight) * 10000) / 100
          : null;
        return { ...leg, computed_score: score };
      });

      legislators.sort((a, b) => (b.computed_score ?? -1) - (a.computed_score ?? -1));
    }
  }

  // Compute top/bottom scorers and average
  const scoredLegislators = legislators.filter((l) => l.computed_score !== null);
  const topScorers = scoredLegislators.slice(0, 10);
  const bottomScorers = [...scoredLegislators].reverse().slice(0, 10);
  const averageScore = scoredLegislators.length > 0
    ? Math.round(
        (scoredLegislators.reduce((sum, l) => sum + (l.computed_score ?? 0), 0) /
        scoredLegislators.length) * 100
      ) / 100
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-blue to-rlc-blue/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">{session.name}</h1>
          <p className="mt-2 text-lg text-white/90">
            {session.jurisdiction === 'federal' ? 'Federal' : session.state_code} Liberty Scorecard | {session.session_year}
          </p>
          <p className="mt-4 text-white/70">
            {legislators.length} legislators scored across {bills.length} bills
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-heading text-xl font-semibold">Liberty Scorecard</h2>
            <ShareButtons
              url={`/scorecards/${slug}`}
              title={`${session.name} Liberty Scorecard`}
              text={`Check out the ${session.name} Liberty Scorecard from the Republican Liberty Caucus!`}
              compact
            />
          </div>

          <ScorecardTabs
            defaultTab="top-defenders"
            tabs={[
              {
                id: 'overview',
                label: 'Overview',
                content: (
                  <ScorecardOverview
                    session={session}
                    billCount={bills.length}
                    legislatorCount={legislators.length}
                  />
                ),
              },
              {
                id: 'top-defenders',
                label: 'Top Defenders',
                content: (
                  <TopDefenders
                    topScorers={topScorers}
                    bottomScorers={bottomScorers}
                    averageScore={averageScore}
                    scorecardSlug={slug}
                  />
                ),
              },
              {
                id: 'bills',
                label: 'Bills',
                content: <BillExplanations bills={bills} />,
              },
              {
                id: 'vote-matrix',
                label: 'Vote Matrix',
                content: (
                  <VoteMatrix
                    legislators={legislators}
                    bills={bills}
                    votes={allVotes}
                    scorecardSlug={slug}
                  />
                ),
              },
              {
                id: 'all-legislators',
                label: 'All Legislators',
                content: <LegislatorTable legislators={legislators} scorecardSlug={slug} />,
              },
            ]}
          />
        </div>
      </section>

      <Footer />
    </div>
  );
}
