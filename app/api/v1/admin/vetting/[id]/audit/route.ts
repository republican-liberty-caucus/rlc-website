import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext } from '@/lib/vetting/permissions';
import { auditTriggerSchema } from '@/lib/validations/vetting';
import { runAudit } from '@/lib/vetting/audit-engine';
import { logger } from '@/lib/logger';
import type { AuditStatus } from '@/types';

/**
 * GET /api/v1/admin/vetting/[id]/audit
 * Returns the latest audit for a vetting, including platforms.
 */
export async function GET(
  _request: Request,
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
    const supabase = createServerClient();

    // Fetch latest audit for this vetting
    const { data: rawAudit, error: auditErr } = await supabase
      .from('rlc_candidate_digital_audits')
      .select('*')
      .eq('vetting_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditErr) {
      logger.error('Error fetching audit:', { vettingId: id, error: auditErr });
      return NextResponse.json({ error: 'Failed to fetch audit' }, { status: 500 });
    }

    if (!rawAudit) {
      return NextResponse.json({ audit: null });
    }

    const audit = rawAudit as Record<string, unknown> & { id: string };

    // Fetch platforms for this audit
    const { data: rawPlatforms, error: platErr } = await supabase
      .from('rlc_candidate_audit_platforms')
      .select('*')
      .eq('audit_id', audit.id)
      .order('entity_type', { ascending: true })
      .order('total_score', { ascending: false });

    if (platErr) {
      logger.error('Error fetching audit platforms:', { auditId: audit.id, error: platErr });
    }

    return NextResponse.json({
      audit: {
        ...audit,
        platforms: rawPlatforms ?? [],
      },
    });
  } catch (err) {
    logger.error('Unhandled error in GET /api/v1/admin/vetting/[id]/audit:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * POST /api/v1/admin/vetting/[id]/audit
 * Trigger a new audit (or re-run). Runs in background via after().
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || (!ctx.isChair && !ctx.isNational)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Parse optional body
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine — defaults apply
    }

    const parseResult = auditTriggerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { force } = parseResult.data;
    const supabase = createServerClient();

    // Verify vetting exists
    const { data: rawVetting, error: vErr } = await supabase
      .from('rlc_candidate_vettings')
      .select('id')
      .eq('id', id)
      .single();

    if (vErr) {
      if (vErr.code === 'PGRST116') {
        return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
      }
      logger.error('Error fetching vetting for audit:', { id, error: vErr });
      return NextResponse.json({ error: 'Failed to fetch vetting' }, { status: 500 });
    }

    // Check for existing running audit (prevent duplicates)
    if (!force) {
      const { data: existingRaw } = await supabase
        .from('rlc_candidate_digital_audits')
        .select('id, status')
        .eq('vetting_id', id)
        .in('status', ['running', 'audit_completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const existing = existingRaw as { id: string; status: string } | null;

      if (existing?.status === 'running') {
        return NextResponse.json(
          { error: 'Audit already running', auditId: existing.id },
          { status: 409 },
        );
      }

      if (existing?.status === 'audit_completed') {
        return NextResponse.json(
          { error: 'Audit already completed. Use force=true to re-run.', auditId: existing.id },
          { status: 409 },
        );
      }
    }

    // Create audit record
    const auditId = crypto.randomUUID();
    const { error: insertErr } = await supabase
      .from('rlc_candidate_digital_audits')
      .insert({
        id: auditId,
        vetting_id: id,
        status: 'audit_pending',
        triggered_by_id: ctx.member.id,
      } as never);

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json(
          { error: 'An audit is already in progress for this vetting' },
          { status: 409 },
        );
      }
      logger.error('Error creating audit record:', { vettingId: id, error: insertErr });
      return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 });
    }

    // Run audit in background (runAudit handles its own error → audit_failed status)
    after(() => {
      runAudit(id, auditId, ctx.member.id).catch(async (err) => {
        logger.error('[Audit] Background execution failed:', err);
        try {
          const sb = createServerClient();
          await sb
            .from('rlc_candidate_digital_audits')
            .update({
              status: 'audit_failed',
              error_message: err instanceof Error ? err.message : String(err),
              completed_at: new Date().toISOString(),
            } as never)
            .eq('id', auditId);
        } catch { /* best-effort */ }
      });
    });

    return NextResponse.json(
      { auditId, status: 'running' as AuditStatus },
      { status: 202 },
    );
  } catch (err) {
    logger.error('Unhandled error in POST /api/v1/admin/vetting/[id]/audit:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
