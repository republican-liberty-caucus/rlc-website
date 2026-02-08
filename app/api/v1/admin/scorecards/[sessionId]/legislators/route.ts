import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import type { Legislator } from '@/types';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId } = await params;
  const supabase = createServerClient();

  // Get all bills for this session
  const { data: billsData, error: billsError } = await supabase
    .from('rlc_scorecard_bills')
    .select('id')
    .eq('session_id', sessionId);

  if (billsError) {
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }

  const bills = (billsData || []) as { id: string }[];
  if (bills.length === 0) {
    return NextResponse.json({ legislators: [] });
  }

  const billIds = bills.map((b) => b.id);

  // Get votes for these bills
  const { data: votesData, error: votesError } = await supabase
    .from('rlc_scorecard_votes')
    .select('legislator_id, aligned_with_liberty, bill_id')
    .in('bill_id', billIds);

  if (votesError) {
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
  }

  const votes = (votesData || []) as { legislator_id: string; aligned_with_liberty: boolean; bill_id: string }[];

  // Get bill weights
  const { data: billWeightsData, error: weightsError } = await supabase
    .from('rlc_scorecard_bills')
    .select('id, weight')
    .in('id', billIds);

  if (weightsError) {
    logger.error('Failed to fetch bill weights:', weightsError);
    return NextResponse.json({ error: 'Failed to fetch bill weights' }, { status: 500 });
  }

  const billWeights = (billWeightsData || []) as { id: string; weight: number }[];
  const weightMap = new Map<string, number>();
  for (const b of billWeights) {
    weightMap.set(b.id, Number(b.weight) || 1);
  }

  // Compute scores per legislator
  const legislatorScores = new Map<string, { weightedSum: number; totalWeight: number }>();
  for (const vote of votes) {
    const current = legislatorScores.get(vote.legislator_id) || { weightedSum: 0, totalWeight: 0 };
    const weight = weightMap.get(vote.bill_id) || 1;
    current.totalWeight += weight;
    if (vote.aligned_with_liberty) {
      current.weightedSum += weight;
    }
    legislatorScores.set(vote.legislator_id, current);
  }

  // Get legislator details
  const legislatorIds = Array.from(legislatorScores.keys());
  if (legislatorIds.length === 0) {
    return NextResponse.json({ legislators: [] });
  }

  const { data: legislatorsData, error: legislatorsError } = await supabase
    .from('rlc_legislators')
    .select('*')
    .in('id', legislatorIds);

  if (legislatorsError) {
    logger.error('Failed to fetch legislators:', legislatorsError);
    return NextResponse.json({ error: 'Failed to fetch legislators' }, { status: 500 });
  }

  const legislators = (legislatorsData || []) as Legislator[];

  const result = legislators.map((leg) => {
    const scores = legislatorScores.get(leg.id);
    const score = scores && scores.totalWeight > 0
      ? Math.round((scores.weightedSum / scores.totalWeight) * 10000) / 100
      : null;
    return { ...leg, computed_score: score };
  });

  result.sort((a, b) => (b.computed_score ?? -1) - (a.computed_score ?? -1));

  return NextResponse.json({ legislators: result });
}
