import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { getRollCall } from '@/lib/legiscan/client';
import { computeScoresForSession } from '@/lib/scorecard/compute-scores';
import type { LegislativeChamber, VoteChoice } from '@/types';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

function verifySecret(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

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

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured');
    return apiError('Server configuration error', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!verifySecret(token, cronSecret)) {
    return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
  }

  const supabase = createServerClient();
  const results = {
    sessionsProcessed: 0,
    votesImported: 0,
    scoresUpdated: 0,
    errors: [] as string[],
  };

  // Get all active scorecard sessions
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('rlc_scorecard_sessions')
    .select('id, jurisdiction, state_code')
    .eq('status', 'active');

  if (sessionsError) {
    logger.error('Failed to fetch active sessions:', sessionsError);
    return apiError('Failed to fetch sessions', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const sessions = (sessionsData || []) as { id: string; jurisdiction: string; state_code: string | null }[];

  for (const session of sessions) {
    try {
      const stateCode = session.jurisdiction === 'federal' ? 'US' : (session.state_code || 'US');

      // Get tracking bills with roll call IDs
      const { data: billsData, error: billsError } = await supabase
        .from('rlc_scorecard_bills')
        .select('id, legiscan_roll_call_id, liberty_position')
        .eq('session_id', session.id)
        .eq('bill_status', 'tracking')
        .not('legiscan_roll_call_id', 'is', null);

      if (billsError) {
        results.errors.push(`Session ${session.id} bills query: ${billsError.message}`);
        continue;
      }

      const bills = (billsData || []) as { id: string; legiscan_roll_call_id: number; liberty_position: string }[];

      for (const bill of bills) {
        try {
          const rollCall = await getRollCall(bill.legiscan_roll_call_id);

          // Only import if votes exist (roll call has happened)
          if (rollCall.total === 0) continue;

          for (const vote of rollCall.votes) {
            // Ensure legislator exists
            const { data: existing } = await supabase
              .from('rlc_legislators')
              .select('id')
              .eq('legiscan_people_id', vote.people_id)
              .single();

            const existingLeg = existing as { id: string } | null;
            let legislatorId: string;

            if (existingLeg) {
              legislatorId = existingLeg.id;
            } else {
              legislatorId = crypto.randomUUID();
              const { error: insertError } = await supabase
                .from('rlc_legislators')
                .insert({
                  id: legislatorId,
                  legiscan_people_id: vote.people_id,
                  name: `Legislator ${vote.people_id}`,
                  party: 'Unknown',
                  chamber: mapChamber(rollCall.chamber_id, stateCode),
                  state_code: stateCode,
                } as never);

              if (insertError) {
                // Race condition: another process may have inserted first
                const { data: retry, error: retryError } = await supabase
                  .from('rlc_legislators')
                  .select('id')
                  .eq('legiscan_people_id', vote.people_id)
                  .single();
                const retryLeg = retry as { id: string } | null;
                if (retryLeg) {
                  legislatorId = retryLeg.id;
                } else {
                  logger.error(`Failed to insert/find legislator ${vote.people_id}: insert=${insertError.message}, retry=${retryError?.message}`);
                  results.errors.push(`Legislator ${vote.people_id}: insert failed and retry lookup failed`);
                  continue;
                }
              }
            }

            const voteChoice = mapVoteText(vote.vote_text);
            const aligned = voteChoice === 'yea'
              ? bill.liberty_position === 'yea'
              : voteChoice === 'nay'
                ? bill.liberty_position === 'nay'
                : false;

            const { error: upsertError } = await supabase
              .from('rlc_scorecard_votes')
              .upsert({
                bill_id: bill.id,
                legislator_id: legislatorId,
                vote: voteChoice,
                aligned_with_liberty: aligned,
              } as never, {
                onConflict: 'bill_id,legislator_id',
              });

            if (upsertError) {
              results.errors.push(`Vote upsert bill=${bill.id} legislator=${legislatorId}: ${upsertError.message}`);
            } else {
              results.votesImported++;
            }
          }

          // Mark bill as voted
          const { error: statusError } = await supabase
            .from('rlc_scorecard_bills')
            .update({
              bill_status: 'voted',
              vote_date: rollCall.date,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', bill.id);

          if (statusError) {
            results.errors.push(`Bill ${bill.id} status update: ${statusError.message}`);
          }
        } catch (err) {
          results.errors.push(`Bill ${bill.id}: ${err}`);
        }
      }

      // Recompute scores for this session
      const scoreResult = await computeScoresForSession(session.id);
      results.scoresUpdated += scoreResult.updated;
      results.sessionsProcessed++;
    } catch (err) {
      results.errors.push(`Session ${session.id}: ${err}`);
    }
  }

  logger.info(
    `Scorecard cron completed: ${results.sessionsProcessed} sessions, ` +
    `${results.votesImported} votes imported, ${results.scoresUpdated} scores updated` +
    (results.errors.length > 0 ? ` | ${results.errors.length} errors` : '')
  );

  if (results.errors.length > 0) {
    logger.error('Scorecard cron errors:', results.errors);
  }

  return NextResponse.json({
    success: results.errors.length === 0,
    ...results,
    timestamp: new Date().toISOString(),
  }, { status: results.errors.length > 0 ? 500 : 200 });
}
