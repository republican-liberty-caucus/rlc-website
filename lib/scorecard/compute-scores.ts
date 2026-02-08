import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface VoteRow {
  legislator_id: string;
  aligned_with_liberty: boolean;
  bill_id: string;
}

interface BillWeight {
  id: string;
  weight: number;
}

/**
 * Compute liberty scores for all legislators in a session.
 * Score = SUM(weight * aligned) / SUM(weight) * 100
 */
export async function computeScoresForSession(sessionId: string): Promise<{ updated: number }> {
  const supabase = createServerClient();

  // Get all bills for this session
  const { data: billsData, error: billsError } = await supabase
    .from('rlc_scorecard_bills')
    .select('id, weight')
    .eq('session_id', sessionId)
    .eq('bill_status', 'voted');

  if (billsError) {
    throw new Error(`Failed to fetch bills: ${billsError.message}`);
  }

  const bills = (billsData || []) as BillWeight[];
  if (bills.length === 0) return { updated: 0 };

  const billIds = bills.map((b) => b.id);
  const weightMap = new Map<string, number>();
  for (const b of bills) {
    weightMap.set(b.id, Number(b.weight) || 1);
  }

  // Get all votes for these bills
  const { data: votesData, error: votesError } = await supabase
    .from('rlc_scorecard_votes')
    .select('legislator_id, aligned_with_liberty, bill_id')
    .in('bill_id', billIds);

  if (votesError) {
    throw new Error(`Failed to fetch votes: ${votesError.message}`);
  }

  const votes = (votesData || []) as VoteRow[];

  // Compute weighted scores per legislator
  const scores = new Map<string, { weightedSum: number; totalWeight: number }>();
  for (const vote of votes) {
    const current = scores.get(vote.legislator_id) || { weightedSum: 0, totalWeight: 0 };
    const weight = weightMap.get(vote.bill_id) || 1;
    current.totalWeight += weight;
    if (vote.aligned_with_liberty) {
      current.weightedSum += weight;
    }
    scores.set(vote.legislator_id, current);
  }

  // Update each legislator's current_score
  let updated = 0;
  const errors: string[] = [];
  for (const [legislatorId, data] of scores) {
    const score = data.totalWeight > 0
      ? Math.round((data.weightedSum / data.totalWeight) * 10000) / 100
      : 0;

    const { error } = await supabase
      .from('rlc_legislators')
      .update({
        current_score: score,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', legislatorId);

    if (error) {
      logger.error(`Failed to update score for legislator ${legislatorId}:`, error.message);
      errors.push(legislatorId);
    } else {
      updated++;
    }
  }

  if (errors.length > 0) {
    logger.error(`Score computation: ${errors.length} legislators failed to update out of ${scores.size}`);
  }

  return { updated };
}
