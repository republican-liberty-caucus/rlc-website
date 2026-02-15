import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline, canCastBoardVote } from '@/lib/vetting/permissions';
import { boardVoteSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canViewPipeline(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id } = await params;
    const supabase = createServerClient();

    // Fetch existing votes with voter names (voter_id FK → rlc_contacts)
    const { data: rawVotes, error: votesError } = await supabase
      .from('rlc_candidate_vetting_board_votes')
      .select(`
        id, vetting_id, voter_id, vote, notes, voted_at,
        voter:rlc_contacts!voter_id(id, first_name, last_name)
      `)
      .eq('vetting_id', id)
      .order('voted_at', { ascending: true });

    if (votesError) {
      logger.error('Error fetching board votes:', { vettingId: id, error: votesError });
      return apiError('Failed to fetch votes', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    // Fetch eligible voters: national_board and super_admin role holders
    const { data: rawRoles, error: rolesError } = await supabase
      .from('rlc_contact_roles')
      .select('contact_id')
      .in('role', ['national_board', 'super_admin']);

    if (rolesError) {
      logger.error('Error fetching eligible voter roles:', { error: rolesError });
      return apiError('Failed to fetch eligible voters', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    // Deduplicate contact IDs and fetch member details
    const contactIds = [...new Set((rawRoles ?? []).map((r) => (r as unknown as { contact_id: string }).contact_id))];

    let eligibleVoters: { id: string; first_name: string; last_name: string }[] = [];
    if (contactIds.length > 0) {
      const { data: rawMembers, error: membersError } = await supabase
        .from('rlc_contacts')
        .select('id, first_name, last_name')
        .in('id', contactIds);

      if (membersError) {
        logger.error('Error fetching eligible voter details:', { error: membersError });
        return apiError('Failed to fetch eligible voters', ApiErrorCode.INTERNAL_ERROR, 500);
      }
      eligibleVoters = (rawMembers ?? []) as unknown as typeof eligibleVoters;
    }

    return NextResponse.json({
      votes: rawVotes ?? [],
      eligibleVoters,
    });
  } catch (err) {
    logger.error('Unhandled error in GET /api/v1/admin/vetting/[id]/votes:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canCastBoardVote(ctx)) {
      return apiError('Forbidden: only national board members can vote', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = boardVoteSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { vote, notes } = parseResult.data;
    const supabase = createServerClient();

    // Verify vetting exists, is at board_vote stage, and is not finalized
    const { data: rawVetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, stage, endorsed_at')
      .eq('id', id)
      .single();

    if (vettingError) {
      if (vettingError.code === 'PGRST116') {
        return apiError('Vetting not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error fetching vetting for vote:', { id, error: vettingError });
      return apiError('Failed to fetch vetting', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const vetting = rawVetting as unknown as { id: string; stage: string; endorsed_at: string | null };

    if (vetting.stage !== 'board_vote') {
      return apiError('Voting is only available at the board_vote stage', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    if (vetting.endorsed_at) {
      return apiError('Voting has been finalized. No further changes allowed.', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    // Use the contact (member) ID as voter_id — FK references rlc_contacts
    const voterId = ctx.member.id;

    // Upsert: one vote per voter per vetting (unique constraint on vetting_id + voter_id)
    const { data: upserted, error: upsertError } = await supabase
      .from('rlc_candidate_vetting_board_votes')
      .upsert(
        {
          vetting_id: id,
          voter_id: voterId,
          vote,
          notes: notes?.trim() || null,
          voted_at: new Date().toISOString(),
        } as never,
        { onConflict: 'vetting_id,voter_id' }
      )
      .select()
      .single();

    if (upsertError) {
      logger.error('Error casting board vote:', { vettingId: id, voterId, error: upsertError });
      return apiError('Failed to cast vote', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ vote: upserted }, { status: 200 });
  } catch (err) {
    logger.error('Unhandled error in POST /api/v1/admin/vetting/[id]/votes:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
