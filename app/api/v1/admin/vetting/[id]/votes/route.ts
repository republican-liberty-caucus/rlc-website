import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canViewPipeline, canCastBoardVote } from '@/lib/vetting/permissions';
import { boardVoteSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canViewPipeline(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    // Fetch existing votes with voter names (voter_id FK → rlc_members)
    const { data: rawVotes, error: votesError } = await supabase
      .from('rlc_candidate_vetting_board_votes')
      .select(`
        id, vetting_id, voter_id, vote, notes, voted_at,
        voter:rlc_members!voter_id(id, first_name, last_name)
      `)
      .eq('vetting_id', id)
      .order('voted_at', { ascending: true });

    if (votesError) {
      logger.error('Error fetching board votes:', { vettingId: id, error: votesError });
      return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
    }

    // Fetch eligible voters: national_board and super_admin role holders
    const { data: rawRoles, error: rolesError } = await supabase
      .from('rlc_member_roles')
      .select('contact_id')
      .in('role', ['national_board', 'super_admin']);

    if (rolesError) {
      logger.error('Error fetching eligible voter roles:', { error: rolesError });
      return NextResponse.json({ error: 'Failed to fetch eligible voters' }, { status: 500 });
    }

    // Deduplicate contact IDs and fetch member details
    const contactIds = [...new Set((rawRoles ?? []).map((r) => (r as unknown as { contact_id: string }).contact_id))];

    let eligibleVoters: { id: string; first_name: string; last_name: string }[] = [];
    if (contactIds.length > 0) {
      const { data: rawMembers, error: membersError } = await supabase
        .from('rlc_members')
        .select('id, first_name, last_name')
        .in('id', contactIds);

      if (membersError) {
        logger.error('Error fetching eligible voter details:', { error: membersError });
        return NextResponse.json({ error: 'Failed to fetch eligible voters' }, { status: 500 });
      }
      eligibleVoters = (rawMembers ?? []) as unknown as typeof eligibleVoters;
    }

    return NextResponse.json({
      votes: rawVotes ?? [],
      eligibleVoters,
    });
  } catch (err) {
    logger.error('Unhandled error in GET /api/v1/admin/vetting/[id]/votes:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canCastBoardVote(ctx)) {
      return NextResponse.json({ error: 'Forbidden: only national board members can vote' }, { status: 403 });
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = boardVoteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
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
        return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
      }
      logger.error('Error fetching vetting for vote:', { id, error: vettingError });
      return NextResponse.json({ error: 'Failed to fetch vetting' }, { status: 500 });
    }

    const vetting = rawVetting as unknown as { id: string; stage: string; endorsed_at: string | null };

    if (vetting.stage !== 'board_vote') {
      return NextResponse.json(
        { error: 'Voting is only available at the board_vote stage' },
        { status: 400 }
      );
    }

    if (vetting.endorsed_at) {
      return NextResponse.json(
        { error: 'Voting has been finalized. No further changes allowed.' },
        { status: 400 }
      );
    }

    // Use the contact (member) ID as voter_id — FK references rlc_members
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
      return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 });
    }

    return NextResponse.json({ vote: upserted }, { status: 200 });
  } catch (err) {
    logger.error('Unhandled error in POST /api/v1/admin/vetting/[id]/votes:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
