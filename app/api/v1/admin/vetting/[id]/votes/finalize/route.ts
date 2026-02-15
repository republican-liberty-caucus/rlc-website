import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canCastBoardVote } from '@/lib/vetting/permissions';
import { tallyVotes, getEndorsementResult } from '@/lib/vetting/engine';
import { logger } from '@/lib/logger';
import { slugify } from '@/lib/utils';
import type { BoardVoteChoice, VettingRecommendation } from '@/types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPressReleaseTitle(
  endorsementResult: VettingRecommendation,
  candidateName: string,
  candidateOffice: string | null,
): string {
  const office = candidateOffice || 'Office';
  switch (endorsementResult) {
    case 'endorse':
      return `RLC Endorses ${candidateName} for ${office}`;
    case 'do_not_endorse':
      return `RLC Does Not Endorse ${candidateName} for ${office}`;
    case 'no_position':
      return `RLC Takes No Position on ${candidateName} for ${office}`;
    default:
      return `RLC Endorsement Decision: ${candidateName} for ${office}`;
  }
}

function buildPressReleaseContent(
  endorsementResult: VettingRecommendation,
  candidateName: string,
  candidateOffice: string | null,
  candidateState: string | null,
  candidateDistrict: string | null,
  endorsedAt: string,
): string {
  const name = escapeHtml(candidateName);
  const office = escapeHtml(candidateOffice || 'Office');
  const location = [candidateState, candidateDistrict].filter((s): s is string => !!s).map(escapeHtml).join(', ');
  const dateStr = new Date(endorsedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let decision: string;
  switch (endorsementResult) {
    case 'endorse':
      decision = `has endorsed ${name}`;
      break;
    case 'do_not_endorse':
      decision = `has decided not to endorse ${name}`;
      break;
    case 'no_position':
      decision = `has taken no position on the candidacy of ${name}`;
      break;
    default:
      decision = `has made an endorsement decision regarding ${name}`;
  }

  return `<p>The Republican Liberty Caucus ${decision} for ${office}${location ? ` (${location})` : ''}.</p>

<p>This decision was reached on ${dateStr} following a thorough vetting process by the RLC Candidate Vetting Committee and a vote by the National Board of Directors.</p>

<p><em>This is a draft press release. Please edit the content before publishing.</em></p>`;
}

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
      .select('id, stage, endorsed_at, candidate_response_id, candidate_name, candidate_office, candidate_state, candidate_district')
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
      candidate_name: string;
      candidate_office: string | null;
      candidate_state: string | null;
      candidate_district: string | null;
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
        logger.warn('Failed to sync endorsement to candidate_responses:', {
          candidateResponseId: vetting.candidate_response_id,
          error: syncError,
        });
      }
    }

    // Auto-create draft press release post (non-fatal)
    let pressReleasePostId: string | null = null;
    try {
      const title = buildPressReleaseTitle(endorsementResult, vetting.candidate_name, vetting.candidate_office);
      const dateSlug = new Date().toISOString().slice(0, 10);
      const slug = `press-release-${slugify(vetting.candidate_name)}-${id.slice(0, 8)}-${dateSlug}`;
      const content = buildPressReleaseContent(
        endorsementResult,
        vetting.candidate_name,
        vetting.candidate_office,
        vetting.candidate_state,
        vetting.candidate_district,
        endorsedAt,
      );

      const tags: string[] = [];
      if (vetting.candidate_state) tags.push(vetting.candidate_state.toLowerCase());

      const { data: postData, error: postError } = await supabase
        .from('rlc_posts')
        .insert({
          title,
          slug,
          content,
          excerpt: title,
          content_type: 'press_release',
          status: 'draft',
          categories: ['press-release', 'endorsement'],
          tags,
          metadata: {},
        } as never)
        .select('id')
        .single();

      if (postError) {
        logger.warn('Failed to create press release draft:', { vettingId: id, error: postError });
      } else if (postData) {
        pressReleasePostId = (postData as { id: string }).id;

        // Link the post to the vetting and advance stage
        const { error: linkError } = await supabase
          .from('rlc_candidate_vettings')
          .update({
            press_release_post_id: pressReleasePostId,
            stage: 'press_release_created',
          } as never)
          .eq('id', id);

        if (linkError) {
          logger.warn('Failed to link press release post to vetting:', {
            vettingId: id,
            postId: pressReleasePostId,
            error: linkError,
          });
        }
      }
    } catch (prError) {
      logger.warn('Unexpected error creating press release draft:', { vettingId: id, error: prError });
    }

    return NextResponse.json({
      vetting: updated,
      tally,
      endorsementResult,
      pressReleasePostId,
    });
  } catch (err) {
    logger.error('Unhandled error in POST /api/v1/admin/vetting/[id]/votes/finalize:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
