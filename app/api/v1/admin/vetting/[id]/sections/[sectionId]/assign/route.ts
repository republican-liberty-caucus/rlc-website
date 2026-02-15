import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canAssignSections } from '@/lib/vetting/permissions';
import { sectionAssignSchema } from '@/lib/validations/vetting';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canAssignSections(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id, sectionId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = sectionAssignSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { committeeMemberId } = parseResult.data;
    const supabase = createServerClient();

    // Verify section belongs to this vetting
    const { data: rawSection, error: sectionError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select('id, vetting_id, status')
      .eq('id', sectionId)
      .single();

    if (sectionError || !rawSection) {
      return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
    }

    const section = rawSection as unknown as { id: string; vetting_id: string; status: string };

    if (section.vetting_id !== id) {
      return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
    }

    // Verify committee member exists, is active, and is on the vetting's committee
    const { data: rawVetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('committee_id')
      .eq('id', id)
      .single();

    const vetting = rawVetting as unknown as { committee_id: string | null } | null;

    if (vettingError || !vetting?.committee_id) {
      return apiError('Vetting has no committee assigned', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    const { data: member, error: memberError } = await supabase
      .from('rlc_candidate_vetting_committee_members')
      .select('id')
      .eq('id', committeeMemberId)
      .eq('committee_id', vetting.committee_id)
      .eq('is_active', true)
      .single();

    if (memberError || !member) {
      return apiError('Committee member not found or inactive on this committee', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    // Create assignment
    const { data: assignment, error: assignError } = await supabase
      .from('rlc_candidate_vetting_section_assignments')
      .insert({
        id: crypto.randomUUID(),
        section_id: sectionId,
        committee_member_id: committeeMemberId,
        assigned_by_id: ctx.member.id,
      } as never)
      .select(`
        *,
        committee_member:rlc_candidate_vetting_committee_members(
          id, role, contact:rlc_contacts(id, first_name, last_name, email)
        )
      `)
      .single();

    if (assignError) {
      if (assignError.code === '23505') {
        return apiError('Member is already assigned to this section', ApiErrorCode.CONFLICT, 409);
      }
      logger.error('Error creating section assignment:', { sectionId, committeeMemberId, error: assignError });
      return apiError('Failed to assign member', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    // Auto-advance section status from not_started to assigned
    if (section.status === 'section_not_started') {
      const { error: advanceError } = await supabase
        .from('rlc_candidate_vetting_report_sections')
        .update({ status: 'section_assigned' } as never)
        .eq('id', sectionId);

      if (advanceError) {
        logger.error('Failed to auto-advance section status after assignment:', {
          sectionId,
          committeeMemberId,
          error: advanceError,
        });
      }
    }

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err) {
    logger.error('Unhandled error in POST sections/[sectionId]/assign:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canAssignSections(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id, sectionId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = sectionAssignSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { committeeMemberId } = parseResult.data;
    const supabase = createServerClient();

    // Verify section belongs to this vetting
    const { data: rawDelSection, error: sectionError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select('id, vetting_id')
      .eq('id', sectionId)
      .single();

    const delSection = rawDelSection as unknown as { id: string; vetting_id: string } | null;

    if (sectionError || !delSection || delSection.vetting_id !== id) {
      return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
    }

    const { data: deleted, error: deleteError } = await supabase
      .from('rlc_candidate_vetting_section_assignments')
      .delete()
      .eq('section_id', sectionId)
      .eq('committee_member_id', committeeMemberId)
      .select('id');

    if (deleteError) {
      logger.error('Error removing section assignment:', { sectionId, committeeMemberId, error: deleteError });
      return apiError('Failed to remove assignment', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    if (!deleted || deleted.length === 0) {
      return apiError('Assignment not found', ApiErrorCode.NOT_FOUND, 404);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Unhandled error in DELETE sections/[sectionId]/assign:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
