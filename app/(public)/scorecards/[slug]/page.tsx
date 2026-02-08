import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { LegislatorTable } from '@/components/scorecards/legislator-table';
import type { ScorecardSession, ScorecardBill, Legislator } from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_scorecard_sessions')
    .select('name')
    .eq('slug', slug)
    .single();

  const session = data as { name: string } | null;
  return {
    title: session ? `${session.name} - Liberty Scorecard` : 'Liberty Scorecard',
    description: session ? `See how legislators scored on the ${session.name} Liberty Scorecard.` : 'Liberty Scorecard results',
  };
}

export default async function ScorecardDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: sessionData, error: sessionError } = await supabase
    .from('rlc_scorecard_sessions')
    .select('*')
    .eq('slug', slug)
    .in('status', ['active', 'published'])
    .single();

  if (sessionError || !sessionData) notFound();
  const session = sessionData as ScorecardSession;

  // Get bills
  const { data: billsData } = await supabase
    .from('rlc_scorecard_bills')
    .select('id, weight')
    .eq('session_id', session.id)
    .eq('bill_status', 'voted');

  const bills = (billsData || []) as Pick<ScorecardBill, 'id' | 'weight'>[];
  const billIds = bills.map((b) => b.id);
  const weightMap = new Map<string, number>();
  for (const b of bills) {
    weightMap.set(b.id, Number(b.weight) || 1);
  }

  // Get votes
  let legislators: (Legislator & { computed_score: number | null })[] = [];

  if (billIds.length > 0) {
    const { data: votesData } = await supabase
      .from('rlc_scorecard_votes')
      .select('legislator_id, aligned_with_liberty, bill_id')
      .in('bill_id', billIds);

    const votes = (votesData || []) as { legislator_id: string; aligned_with_liberty: boolean; bill_id: string }[];

    const scores = new Map<string, { weightedSum: number; totalWeight: number }>();
    for (const vote of votes) {
      const current = scores.get(vote.legislator_id) || { weightedSum: 0, totalWeight: 0 };
      const weight = weightMap.get(vote.bill_id) || 1;
      current.totalWeight += weight;
      if (vote.aligned_with_liberty) current.weightedSum += weight;
      scores.set(vote.legislator_id, current);
    }

    const legislatorIds = Array.from(scores.keys());
    if (legislatorIds.length > 0) {
      const { data: legData } = await supabase
        .from('rlc_legislators')
        .select('*')
        .in('id', legislatorIds);

      legislators = ((legData || []) as Legislator[]).map((leg) => {
        const s = scores.get(leg.id);
        const score = s && s.totalWeight > 0
          ? Math.round((s.weightedSum / s.totalWeight) * 10000) / 100
          : null;
        return { ...leg, computed_score: score };
      });

      legislators.sort((a, b) => (b.computed_score ?? -1) - (a.computed_score ?? -1));
    }
  }

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
          <LegislatorTable legislators={legislators} scorecardSlug={slug} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
