import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import type { MembershipStatus } from '@/types';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

// Vercel Cron calls this endpoint daily.
// Protected by CRON_SECRET to prevent unauthorized access.
//
// Status transitions (matching CiviCRM model):
//   new_member → current   (after 90 days from join date)
//   current → expiring     (30 days before expiry)
//   expiring → grace       (after expiry date)
//   grace → expired        (30 days after expiry — configurable)

const GRACE_PERIOD_DAYS = 30;
const NEW_MEMBER_DAYS = 90;
const EXPIRING_WARNING_DAYS = 30;

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

export async function GET(req: Request) {
  // Verify cron secret
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
  const now = new Date();
  const results = {
    newToCurrent: 0,
    currentToExpiring: 0,
    expiringToGrace: 0,
    graceToExpired: 0,
    errors: [] as string[],
  };

  // 1. new_member → current (joined more than 90 days ago, based on join date)
  try {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - NEW_MEMBER_DAYS);

    const { data, error } = await supabase
      .from('rlc_contacts')
      .update({ membership_status: 'current' as MembershipStatus } as never)
      .eq('membership_status', 'new_member')
      .lte('membership_join_date', cutoff.toISOString())
      .not('membership_join_date', 'is', null)
      .select('id');

    if (error) {
      results.errors.push(`new_member→current: ${error.message}`);
    } else {
      results.newToCurrent = data?.length || 0;
    }
  } catch (err) {
    results.errors.push(`new_member→current: ${err}`);
  }

  // 2. current → expiring (expiry date within 30 days)
  try {
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + EXPIRING_WARNING_DAYS);

    const { data, error } = await supabase
      .from('rlc_contacts')
      .update({ membership_status: 'expiring' as MembershipStatus } as never)
      .eq('membership_status', 'current')
      .lte('membership_expiry_date', warningDate.toISOString())
      .gt('membership_expiry_date', now.toISOString())
      .not('membership_expiry_date', 'is', null)
      .select('id');

    if (error) {
      results.errors.push(`current→expiring: ${error.message}`);
    } else {
      results.currentToExpiring = data?.length || 0;
    }
  } catch (err) {
    results.errors.push(`current→expiring: ${err}`);
  }

  // 3. expiring → grace (past expiry date)
  try {
    const { data, error } = await supabase
      .from('rlc_contacts')
      .update({ membership_status: 'grace' as MembershipStatus } as never)
      .eq('membership_status', 'expiring')
      .lte('membership_expiry_date', now.toISOString())
      .not('membership_expiry_date', 'is', null)
      .select('id');

    if (error) {
      results.errors.push(`expiring→grace: ${error.message}`);
    } else {
      results.expiringToGrace = data?.length || 0;
    }
  } catch (err) {
    results.errors.push(`expiring→grace: ${err}`);
  }

  // 4. grace → expired (past expiry + grace period)
  try {
    const graceExpiry = new Date(now);
    graceExpiry.setDate(graceExpiry.getDate() - GRACE_PERIOD_DAYS);

    const { data, error } = await supabase
      .from('rlc_contacts')
      .update({ membership_status: 'expired' as MembershipStatus } as never)
      .eq('membership_status', 'grace')
      .lte('membership_expiry_date', graceExpiry.toISOString())
      .not('membership_expiry_date', 'is', null)
      .select('id');

    if (error) {
      results.errors.push(`grace→expired: ${error.message}`);
    } else {
      results.graceToExpired = data?.length || 0;
    }
  } catch (err) {
    results.errors.push(`grace→expired: ${err}`);
  }

  const totalTransitions =
    results.newToCurrent +
    results.currentToExpiring +
    results.expiringToGrace +
    results.graceToExpired;

  logger.info(
    `Membership status cron completed: ${totalTransitions} transitions ` +
    `(new→current: ${results.newToCurrent}, current→expiring: ${results.currentToExpiring}, ` +
    `expiring→grace: ${results.expiringToGrace}, grace→expired: ${results.graceToExpired})` +
    (results.errors.length > 0 ? ` | ${results.errors.length} errors` : '')
  );

  if (results.errors.length > 0) {
    logger.error('Cron errors:', results.errors);
    return NextResponse.json({
      success: false,
      transitions: totalTransitions,
      details: {
        newToCurrent: results.newToCurrent,
        currentToExpiring: results.currentToExpiring,
        expiringToGrace: results.expiringToGrace,
        graceToExpired: results.graceToExpired,
        errorCount: results.errors.length,
      },
      timestamp: now.toISOString(),
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    transitions: totalTransitions,
    details: {
      newToCurrent: results.newToCurrent,
      currentToExpiring: results.currentToExpiring,
      expiringToGrace: results.expiringToGrace,
      graceToExpired: results.graceToExpired,
    },
    timestamp: now.toISOString(),
  });
}
