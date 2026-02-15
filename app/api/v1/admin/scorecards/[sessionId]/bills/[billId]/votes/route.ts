import { NextResponse } from 'next/server';
import { getRollCall } from '@/lib/legiscan/client';
import type { LegislativeChamber, VoteChoice } from '@/types';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';

function mapVoteText(voteText: string): VoteChoice {
  switch (voteText) {
    case 'Yea': return 'yea';
    case 'Nay': return 'nay';
    case 'Absent': return 'absent';
    case 'Present': return 'present';
    case 'NV': return 'not_voting';
    default: return 'not_voting';
  }
}

function mapChamber(chamberId: number, stateCode: string): LegislativeChamber {
  if (stateCode === 'US') {
    return chamberId === 1 ? 'us_house' : 'us_senate';
  }
  return chamberId === 1 ? 'state_house' : 'state_senate';
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; billId: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { billId } = await params;

  // Get bill with session info
  const { data: billData, error: billError } = await supabase
    .from('rlc_scorecard_bills')
    .select('id, legiscan_roll_call_id, liberty_position, session_id')
    .eq('id', billId)
    .single();

  if (billError || !billData) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  const bill = billData as { id: string; legiscan_roll_call_id: number | null; liberty_position: string; session_id: string };

  if (!bill.legiscan_roll_call_id) {
    return NextResponse.json({ error: 'No roll call ID set for this bill' }, { status: 400 });
  }

  // Get session for state context
  const { data: sessionData, error: sessionError } = await supabase
    .from('rlc_scorecard_sessions')
    .select('jurisdiction, state_code')
    .eq('id', bill.session_id)
    .single();

  if (sessionError || !sessionData) {
    return NextResponse.json({ error: 'Session not found for this bill' }, { status: 404 });
  }

  const session = sessionData as { jurisdiction: string; state_code: string | null };
  const stateCode = session.jurisdiction === 'federal' ? 'US' : (session.state_code || 'US');

  try {
    const rollCall = await getRollCall(bill.legiscan_roll_call_id);
    const libertyPosition = bill.liberty_position;

    // Upsert legislators and collect their IDs
    const legislatorMap = new Map<number, string>();

    for (const vote of rollCall.votes) {
      // Check if legislator exists
      const { data: existing } = await supabase
        .from('rlc_legislators')
        .select('id')
        .eq('legiscan_people_id', vote.people_id)
        .single();

      const existingLeg = existing as { id: string } | null;
      if (existingLeg) {
        legislatorMap.set(vote.people_id, existingLeg.id);
      } else {
        const id = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('rlc_legislators')
          .insert({
            id,
            legiscan_people_id: vote.people_id,
            name: `Legislator ${vote.people_id}`,
            party: 'Unknown',
            chamber: mapChamber(rollCall.chamber_id, stateCode),
            state_code: stateCode,
          } as never);

        if (insertError) {
          // Might be a race condition — try fetching again
          const { data: retry } = await supabase
            .from('rlc_legislators')
            .select('id')
            .eq('legiscan_people_id', vote.people_id)
            .single();
          const retryLeg = retry as { id: string } | null;
          if (retryLeg) {
            legislatorMap.set(vote.people_id, retryLeg.id);
          }
        } else {
          legislatorMap.set(vote.people_id, id);
        }
      }
    }

    // Insert votes
    let imported = 0;
    for (const vote of rollCall.votes) {
      const legislatorId = legislatorMap.get(vote.people_id);
      if (!legislatorId) continue;

      const voteChoice = mapVoteText(vote.vote_text);
      const aligned = voteChoice === 'yea'
        ? libertyPosition === 'yea'
        : voteChoice === 'nay'
          ? libertyPosition === 'nay'
          : false;

      const { error: voteError } = await supabase
        .from('rlc_scorecard_votes')
        .upsert({
          bill_id: billId,
          legislator_id: legislatorId,
          vote: voteChoice,
          aligned_with_liberty: aligned,
        } as never, {
          onConflict: 'bill_id,legislator_id',
        });

      if (!voteError) imported++;
    }

    // Mark bill as voted
    const { error: statusError } = await supabase
      .from('rlc_scorecard_bills')
      .update({
        bill_status: 'voted',
        vote_date: rollCall.date,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', billId);

    if (statusError) {
      logger.error('Failed to update bill status:', statusError);
    }

    return NextResponse.json({
      imported,
      total: rollCall.votes.length,
      rollCallDate: rollCall.date,
    });
  } catch (err) {
    logger.error('Vote import failed:', err);
    return NextResponse.json({ error: 'Failed to import votes from LegiScan' }, { status: 500 });
  }
}
