import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { ShareButtons } from '@/components/shared/share-buttons';
import { ScoreBadge } from '@/components/ui/score-badge';
import { ArrowLeft } from 'lucide-react';
import type { Legislator, ScorecardSession, ScorecardBill, ScorecardVote } from '@/types';

interface Props {
  params: Promise<{ slug: string; legislatorId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { legislatorId } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_legislators')
    .select('name')
    .eq('id', legislatorId)
    .single();

  const legislator = data as { name: string } | null;
  return {
    title: legislator ? `${legislator.name} - Liberty Scorecard` : 'Legislator Profile',
    description: legislator ? `${legislator.name}'s liberty voting record and score.` : 'Legislator voting record',
  };
}

export default async function LegislatorDetailPage({ params }: Props) {
  const { slug, legislatorId } = await params;
  const supabase = createServerClient();

  // Get session
  const { data: sessionData } = await supabase
    .from('rlc_scorecard_sessions')
    .select('*')
    .eq('slug', slug)
    .in('status', ['active', 'published'])
    .single();

  if (!sessionData) notFound();
  const session = sessionData as ScorecardSession;

  // Get legislator
  const { data: legData } = await supabase
    .from('rlc_legislators')
    .select('*')
    .eq('id', legislatorId)
    .single();

  if (!legData) notFound();
  const legislator = legData as Legislator;

  // Get this session's bills
  const { data: billsData } = await supabase
    .from('rlc_scorecard_bills')
    .select('*')
    .eq('session_id', session.id)
    .eq('bill_status', 'voted')
    .order('vote_date', { ascending: false });

  const bills = (billsData || []) as ScorecardBill[];
  const billIds = bills.map((b) => b.id);

  // Get legislator's votes on these bills
  let votes: ScorecardVote[] = [];
  if (billIds.length > 0) {
    const { data: votesData } = await supabase
      .from('rlc_scorecard_votes')
      .select('*')
      .eq('legislator_id', legislatorId)
      .in('bill_id', billIds);

    votes = (votesData || []) as ScorecardVote[];
  }

  const voteMap = new Map(votes.map((v) => [v.bill_id, v]));

  // Compute score
  let totalWeight = 0;
  let alignedWeight = 0;
  for (const bill of bills) {
    const vote = voteMap.get(bill.id);
    if (vote) {
      const w = Number(bill.weight) || 1;
      totalWeight += w;
      if (vote.aligned_with_liberty) alignedWeight += w;
    }
  }
  const score = totalWeight > 0 ? Math.round((alignedWeight / totalWeight) * 10000) / 100 : null;

  const chamberLabels: Record<string, string> = {
    us_house: 'U.S. House',
    us_senate: 'U.S. Senate',
    state_house: 'State House',
    state_senate: 'State Senate',
  };

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-blue to-rlc-blue/80 py-12 text-white">
        <div className="container mx-auto px-4">
          <Link
            href={`/scorecards/${slug}`}
            className="mb-4 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to {session.name}
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{legislator.name}</h1>
              <p className="mt-1 text-white/90">
                {legislator.party} | {chamberLabels[legislator.chamber] || legislator.chamber} | {legislator.state_code}
                {legislator.district ? ` - District ${legislator.district}` : ''}
              </p>
            </div>
            <div className="sm:ml-auto sm:text-right">
              <p className="text-sm text-white/70">Liberty Score</p>
              <div className="mt-1">
                <ScoreBadge score={score ?? 0} size="lg" />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <ShareButtons
              url={`/scorecards/${slug}/${legislatorId}`}
              title={`${legislator.name} Liberty Score: ${score !== null ? `${score}%` : 'N/A'}`}
              text={`${legislator.name} (${legislator.party}-${legislator.state_code}) scored ${score !== null ? `${score}%` : 'N/A'} on the ${session.name} Liberty Scorecard.`}
              compact
            />
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-xl font-semibold">Vote History</h2>
          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Bill</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Liberty Position</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Vote</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Aligned</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const vote = voteMap.get(bill.id);
                    return (
                      <tr key={bill.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-mono">{bill.bill_number}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-sm">{bill.title}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            bill.liberty_position === 'yea' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {bill.liberty_position.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{vote?.vote || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {vote ? (
                            <span className={`font-medium ${vote.aligned_with_liberty ? 'text-green-600' : 'text-red-600'}`}>
                              {vote.aligned_with_liberty ? 'Yes' : 'No'}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {bill.vote_date || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {bills.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No vote records available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
