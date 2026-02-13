import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext } from '@/lib/vetting/permissions';
import { logger } from '@/lib/logger';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || (!ctx.isCommitteeMember && !ctx.isNational)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      return NextResponse.json({ error: 'Failed to fetch audit' }, { status: 500 });
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
      return NextResponse.json({ error: 'Failed to fetch platforms' }, { status: 500 });
    }

    return NextResponse.json({ platforms: platforms ?? [] });
  } catch (err) {
    logger.error('Unhandled error in GET /api/v1/admin/vetting/[id]/audit/platforms:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
