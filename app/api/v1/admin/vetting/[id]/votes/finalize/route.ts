import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canCastBoardVote } from '@/lib/vetting/permissions';
import { tallyVotes, getEndorsementResult } from '@/lib/vetting/engine';
import { logger } from '@/lib/logger';
import type { BoardVoteChoice } from '@/types';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canCastBoardVote(ctx)) {
      return NextResponse.json({ error: 'Forbidden: only national board members can finalize votes' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    // Fetch vetting — check stage and that it hasn't been finalized yet
    const { data: rawVetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, stage, endorsed_at, candidate_response_id')
      .eq('id', id)
      .single();

    if (vettingError) {
      if (vettingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
      }
      logger.error('Error fetching vetting for finalize:', { id, error: vettingError });
      return NextResponse.json({ error: 'Failed to fetch vetting' }, { status: 500 });
    }

    const vetting = rawVetting as unknown as {
      id: string;
      stage: string;
      endorsed_at: string | null;
      candidate_response_id: string;
    };

    if (vetting.stage !== 'board_vote') {
      return NextResponse.json(
        { error: 'Can only finalize votes at the board_vote stage' },
        { status: 400 }
      );
    }

    if (vetting.endorsed_at) {
      return NextResponse.json(
        { error: 'Votes have already been finalized' },
        { status: 400 }
      );
    }

    // Fetch all votes for this vetting
    const { data: rawVotes, error: votesError } = await supabase
      .from('rlc_candidate_vetting_board_votes')
      .select('vote')
      .eq('vetting_id', id);

    if (votesError) {
      logger.error('Error fetching votes for finalize:', { id, error: votesError });
      return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
    }

    const votes = (rawVotes ?? []) as unknown as { vote: BoardVoteChoice }[];

    // Require at least one non-abstain vote
    const substantiveVotes = votes.filter((v) => v.vote !== 'vote_abstain');
    if (substantiveVotes.length === 0) {
      return NextResponse.json(
        { error: 'At least one non-abstain vote is required to finalize' },
        { status: 400 }
      );
    }

    const tally = tallyVotes(votes);
    const endorsementResult = getEndorsementResult(tally);
    const endorsedAt = new Date().toISOString();

    // Optimistic concurrency: only update if endorsed_at is still null
    const { data: updated, error: updateError } = await supabase
      .from('rlc_candidate_vettings')
      .update({
        endorsement_result: endorsementResult,
        endorsed_at: endorsedAt,
      } as never)
      .eq('id', id)
      .is('endorsed_at', null)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Votes were finalized by another user. Please refresh.' },
          { status: 409 }
        );
      }
      logger.error('Error finalizing votes:', { id, error: updateError });
      return NextResponse.json({ error: 'Failed to finalize votes' }, { status: 500 });
    }

    // Sync endorsement status to candidate_responses if linked
    if (vetting.candidate_response_id) {
      const { error: syncError } = await supabase
        .from('rlc_candidate_responses')
        .update({
          endorsement_result: endorsementResult,
          endorsed_at: endorsedAt,
        } as never)
        .eq('id', vetting.candidate_response_id);

      if (syncError) {
        // Non-fatal: log but don't fail the request
        logger.warn('Failed to sync endorsement to candidate_responses:', {
          candidateResponseId: vetting.candidate_response_id,
          error: syncError,
        });
      }
    }

    return NextResponse.json({
      vetting: updated,
      tally,
      endorsementResult,
    });
  } catch (err) {
    logger.error('Unhandled error in POST /api/v1/admin/vetting/[id]/votes/finalize:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
