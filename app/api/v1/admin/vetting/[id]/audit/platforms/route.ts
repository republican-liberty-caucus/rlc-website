import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext } from '@/lib/vetting/permissions';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

/**
 * GET /api/v1/admin/vetting/[id]/audit/platforms
 * Returns platforms for the latest audit. Optional ?entityType=candidate|opponent filter.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || (!ctx.isCommitteeMember && !ctx.isNational)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    const supabase = createServerClient();

    // Find latest audit for this vetting
    const { data: rawAudit, error: auditErr } = await supabase
      .from('rlc_candidate_digital_audits')
      .select('id')
      .eq('vetting_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditErr) {
      logger.error('Error fetching audit for platforms:', { vettingId: id, error: auditErr });
      return apiError('Failed to fetch audit', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    if (!rawAudit) {
      return NextResponse.json({ platforms: [] });
    }

    const audit = rawAudit as { id: string };

    // Build query
    let query = supabase
      .from('rlc_candidate_audit_platforms')
      .select('*')
      .eq('audit_id', audit.id)
      .order('total_score', { ascending: false });

    if (entityType === 'candidate' || entityType === 'opponent') {
      query = query.eq('entity_type', entityType);
    }

    const { data: platforms, error: platErr } = await query;

    if (platErr) {
      logger.error('Error fetching platforms:', { auditId: audit.id, error: platErr });
      return apiError('Failed to fetch platforms', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ platforms: platforms ?? [] });
  } catch (err) {
    logger.error('Unhandled error in GET /api/v1/admin/vetting/[id]/audit/platforms:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
