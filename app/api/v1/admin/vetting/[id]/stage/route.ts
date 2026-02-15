import { auth } from '@clerk/nextjs/server';
import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canCreateVetting } from '@/lib/vetting/permissions';
import { vettingStageAdvanceSchema } from '@/lib/validations/vetting';
import { canAdvanceStage } from '@/lib/vetting/engine';
import { runAudit } from '@/lib/vetting/audit-engine';
import { logger } from '@/lib/logger';
import type { VettingStage, VettingSectionStatus, VettingReportSectionType } from '@/types';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canCreateVetting(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = vettingStageAdvanceSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { targetStage } = parseResult.data;
    const supabase = createServerClient();

    // Fetch current vetting stage + recommendation
    const { data: rawVetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, stage, recommendation, endorsement_result')
      .eq('id', id)
      .single();

    if (vettingError) {
      if (vettingError.code === 'PGRST116') {
        return apiError('Vetting not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error fetching vetting for stage advance:', { id, error: vettingError });
      return apiError('Failed to fetch vetting', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const vetting = rawVetting as unknown as { id: string; stage: string; recommendation: string | null; endorsement_result: string | null };

    // Fetch sections for gate checks
    const { data: rawSections, error: sectionsError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select('section, status')
      .eq('vetting_id', id);

    if (sectionsError) {
      logger.error('Error fetching sections for stage advance:', { id, error: sectionsError });
      return apiError('Failed to fetch sections', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const sectionStates = (rawSections ?? []) as unknown as { section: VettingReportSectionType; status: VettingSectionStatus }[];

    const gateResult = canAdvanceStage(
      vetting.stage as VettingStage,
      targetStage as VettingStage,
      sectionStates,
      { hasRecommendation: !!vetting.recommendation, hasEndorsementResult: !!vetting.endorsement_result }
    );

    if (!gateResult.allowed) {
      return apiError('Cannot advance stage', ApiErrorCode.VALIDATION_ERROR, 400, { reason: gateResult.reason });
    }

    // Optimistic concurrency: only update if stage hasn't changed since we checked
    const { data: updated, error: updateError } = await supabase
      .from('rlc_candidate_vettings')
      .update({ stage: targetStage } as never)
      .eq('id', id)
      .eq('stage', vetting.stage)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return apiError('Stage was modified by another user. Please refresh and try again.', ApiErrorCode.CONFLICT, 409);
      }
      logger.error('Error advancing stage:', { id, targetStage, error: updateError });
      return apiError('Failed to advance stage', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    // Auto-trigger digital presence audit when advancing to auto_audit
    if (targetStage === 'auto_audit') {
      const auditId = crypto.randomUUID();
      const { error: auditInsertErr } = await supabase
        .from('rlc_candidate_digital_audits')
        .insert({
          id: auditId,
          vetting_id: id,
          status: 'audit_pending',
          triggered_by_id: ctx.member.id,
        } as never);

      if (auditInsertErr) {
        logger.error('Failed to create audit record on stage advance:', { id, error: auditInsertErr });
        // Rollback stage — audit couldn't be created, so auto_audit stage is broken
        await supabase
          .from('rlc_candidate_vettings')
          .update({ stage: vetting.stage } as never)
          .eq('id', id);
        return apiError('Stage advanced but audit initialization failed. Stage rolled back.', ApiErrorCode.INTERNAL_ERROR, 500);
      } else {
        after(() => {
          runAudit(id, auditId, ctx.member.id).catch(async (err) => {
            logger.error('[Audit] Background execution from stage advance failed:', err);
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
            } catch (statusErr) {
              logger.error('[Audit] Fallback status update failed (orphaned audit):', {
                auditId,
                vettingId: id,
                originalError: err instanceof Error ? err.message : String(err),
                statusUpdateError: statusErr,
              });
            }
          });
        });
      }
    }

    return NextResponse.json({ vetting: updated });
  } catch (err) {
    logger.error('Unhandled error in PATCH /api/v1/admin/vetting/[id]/stage:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
