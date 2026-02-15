import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import type { ScorecardSession, ScorecardBill, Legislator } from '@/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EmbedScorecardPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: sessionData } = await supabase
    .from('rlc_scorecard_sessions')
    .select('*')
    .eq('slug', slug)
    .in('status', ['active', 'published'])
    .single();

  if (!sessionData) notFound();
  const session = sessionData as ScorecardSession;

  // Get voted bills
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

  const chamberLabels: Record<string, string> = {
    us_house: 'House',
    us_senate: 'Senate',
    state_house: 'House',
    state_senate: 'Senate',
  };

  function scoreColor(score: number | null): string {
    if (score === null) return 'color: #9ca3af';
    if (score >= 80) return 'color: #16a34a';
    if (score >= 50) return 'color: #ca8a04';
    return 'color: #dc2626';
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>{session.name}</h2>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
        {legislators.length} legislators | {bills.length} bills scored
      </p>

      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Name</th>
            <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Party</th>
            <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Chamber</th>
            <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600 }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {legislators.slice(0, 50).map((leg) => (
            <tr key={leg.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 4px', fontWeight: 500 }}>{leg.name}</td>
              <td style={{ padding: '6px 4px', color: '#6b7280' }}>{leg.party}</td>
              <td style={{ padding: '6px 4px', color: '#6b7280' }}>{chamberLabels[leg.chamber] || leg.chamber}</td>
              <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, ...Object.fromEntries([scoreColor(leg.computed_score).split(': ')]) }}>
                {leg.computed_score !== null ? `${leg.computed_score}%` : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
        <a
          href={`/scorecards/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '11px', color: '#b91c1c', textDecoration: 'none' }}
        >
          Powered by Republican Liberty Caucus
        </a>
      </div>
    </div>
  );
}
