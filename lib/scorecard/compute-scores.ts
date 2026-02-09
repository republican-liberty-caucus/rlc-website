import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface BillRow {
  id: string;
  is_bonus: boolean;
  bonus_point_value: number;
}

interface VoteRow {
  legislator_id: string;
  bill_id: string;
  vote: string;
  aligned_with_liberty: boolean;
  sponsorship_role: string | null;
}

interface SessionRow {
  absence_penalty_threshold: number;
}

interface LegislatorAccumulator {
  votesAligned: number;
  votesAgainst: number;
  absences: number;
  bonusPoints: number;
  billsWithVotes: Set<string>;
}

/**
 * Compute liberty scores for all legislators in a session.
 *
 * Algorithm (matches RLC PDF scorecards):
 *   eligibleVotes = votesAligned + votesAgainst + penalizedAbsences
 *   baseScore = votesAligned / eligibleVotes * 100
 *   libertyScore = round(baseScore + bonusPoints)
 *
 * Absences (not_voting, absent, present) are forgiven up to the threshold.
 * not_applicable votes are excluded entirely (legislator wasn't in office).
 * Bonus points are awarded to sponsors/cosponsors of bonus bills.
 */
export async function computeScoresForSession(sessionId: string): Promise<{ updated: number }> {
  const supabase = createServerClient();

  // Get session config
  const { data: sessionData, error: sessionError } = await supabase
    .from('rlc_scorecard_sessions')
    .select('absence_penalty_threshold')
    .eq('id', sessionId)
    .single();

  if (sessionError || !sessionData) {
    throw new Error(`Failed to fetch session: ${sessionError?.message ?? 'not found'}`);
  }

  const session = sessionData as SessionRow;
  const threshold = session.absence_penalty_threshold;

  // Get all bills for this session
  const { data: billsData, error: billsError } = await supabase
    .from('rlc_scorecard_bills')
    .select('id, is_bonus, bonus_point_value')
    .eq('session_id', sessionId);

  if (billsError) {
    throw new Error(`Failed to fetch bills: ${billsError.message}`);
  }

  const bills = (billsData || []) as BillRow[];
  if (bills.length === 0) return { updated: 0 };

  const regularBills = bills.filter((b) => !b.is_bonus);
  const bonusBills = bills.filter((b) => b.is_bonus);
  const totalRegularBills = regularBills.length;
  const allBillIds = bills.map((b) => b.id);

  const bonusPointMap = new Map<string, number>();
  for (const b of bonusBills) {
    bonusPointMap.set(b.id, Number(b.bonus_point_value) || 0);
  }

  // Get all votes for these bills
  const { data: votesData, error: votesError } = await supabase
    .from('rlc_scorecard_votes')
    .select('legislator_id, bill_id, vote, aligned_with_liberty, sponsorship_role')
    .in('bill_id', allBillIds);

  if (votesError) {
    throw new Error(`Failed to fetch votes: ${votesError.message}`);
  }

  const votes = (votesData || []) as VoteRow[];

  // Accumulate per-legislator stats
  const accumulators = new Map<string, LegislatorAccumulator>();

  function getAccumulator(legislatorId: string): LegislatorAccumulator {
    let acc = accumulators.get(legislatorId);
    if (!acc) {
      acc = { votesAligned: 0, votesAgainst: 0, absences: 0, bonusPoints: 0, billsWithVotes: new Set() };
      accumulators.set(legislatorId, acc);
    }
    return acc;
  }

  for (const vote of votes) {
    const acc = getAccumulator(vote.legislator_id);
    const isBonusBill = bonusPointMap.has(vote.bill_id);

    if (isBonusBill) {
      // For bonus bills, award points to sponsors/cosponsors
      if (vote.sponsorship_role) {
        acc.bonusPoints += bonusPointMap.get(vote.bill_id)!;
      }
    } else {
      // Regular bill
      acc.billsWithVotes.add(vote.bill_id);

      if (vote.vote === 'not_applicable') {
        // Not in office — excluded entirely
        continue;
      }

      if (vote.vote === 'not_voting' || vote.vote === 'absent' || vote.vote === 'present') {
        acc.absences++;
      } else if (vote.aligned_with_liberty) {
        acc.votesAligned++;
      } else {
        acc.votesAgainst++;
      }
    }
  }

  // Also count regular bills with NO vote record as absences
  // (only for legislators who have at least one vote in the session)
  for (const [, acc] of accumulators) {
    const missingVotes = totalRegularBills - acc.billsWithVotes.size;
    if (missingVotes > 0) {
      acc.absences += missingVotes;
    }
  }

  // Compute and upsert scores
  let updated = 0;
  const errors: string[] = [];

  for (const [legislatorId, acc] of accumulators) {
    const penalizedAbsences = Math.max(0, acc.absences - threshold);
    const eligibleVotes = acc.votesAligned + acc.votesAgainst + penalizedAbsences;
    const baseScore = eligibleVotes > 0
      ? (acc.votesAligned / eligibleVotes) * 100
      : 0;
    const libertyScore = Math.round(baseScore + acc.bonusPoints);

    // Upsert into legislator scores table
    const { error: upsertError } = await supabase
      .from('rlc_scorecard_legislator_scores')
      .upsert({
        session_id: sessionId,
        legislator_id: legislatorId,
        votes_aligned: acc.votesAligned,
        total_bills: totalRegularBills,
        absences: acc.absences,
        bonus_points: acc.bonusPoints,
        liberty_score: libertyScore,
        updated_at: new Date().toISOString(),
      } as never, {
        onConflict: 'session_id,legislator_id',
      });

    if (upsertError) {
      logger.error(`Failed to upsert score for legislator ${legislatorId}:`, upsertError.message);
      errors.push(legislatorId);
      continue;
    }

    updated++;

    // Also update the legislator's current_score
    const { error: updateError } = await supabase
      .from('rlc_legislators')
      .update({
        current_score: libertyScore,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', legislatorId);

    if (updateError) {
      logger.error(`Failed to update current_score for legislator ${legislatorId}:`, updateError.message);
    }
  }

  if (errors.length > 0) {
    logger.error(`Score computation: ${errors.length} legislators failed out of ${accumulators.size}`);
  }

  return { updated };
}
