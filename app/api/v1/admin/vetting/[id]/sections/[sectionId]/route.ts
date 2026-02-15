import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canEditSection, canViewPipeline } from '@/lib/vetting/permissions';
import { sectionUpdateSchema } from '@/lib/validations/vetting';
import { isValidSectionTransition } from '@/lib/vetting/engine';
import { logger } from '@/lib/logger';
import type { VettingSectionStatus } from '@/types';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canViewPipeline(ctx)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id, sectionId } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select(`
        *,
        assignments:rlc_candidate_vetting_section_assignments(
          *,
          committee_member:rlc_candidate_vetting_committee_members(
            id, role, contact:rlc_contacts(id, first_name, last_name, email)
          )
        )
      `)
      .eq('id', sectionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error fetching section:', { sectionId, error });
      return apiError('Failed to fetch section', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const sectionData = data as unknown as { vetting_id: string; [key: string]: unknown };

    // Prevent cross-vetting access
    if (sectionData.vetting_id !== id) {
      return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
    }

    return NextResponse.json({ section: data });
  } catch (err) {
    logger.error('Unhandled error in GET sections/[sectionId]:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const ctx = await getVettingContext(userId);
    if (!ctx) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id, sectionId } = await params;
    const supabase = createServerClient();

    interface SectionWithAssignments {
      id: string;
      vetting_id: string;
      status: string;
      assignments: { committee_member_id: string }[];
    }

    // Fetch section with assignments to verify ownership and get current status
    const { data: rawSection, error: fetchError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select(`
        id, vetting_id, status,
        assignments:rlc_candidate_vetting_section_assignments(committee_member_id)
      `)
      .eq('id', sectionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error fetching section for update:', { sectionId, error: fetchError });
      return apiError('Failed to fetch section', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const section = rawSection as unknown as SectionWithAssignments;

    if (section.vetting_id !== id) {
      return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
    }

    const assignedMemberIds = (section.assignments ?? []).map((a) => a.committee_member_id);

    if (!canEditSection(ctx, assignedMemberIds)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
    }

    const parseResult = sectionUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    // Validate status transition if status is being changed
    if (parseResult.data.status) {
      if (!isValidSectionTransition(section.status as VettingSectionStatus, parseResult.data.status)) {
        return apiError(`Invalid status transition from ${section.status} to ${parseResult.data.status}`, ApiErrorCode.VALIDATION_ERROR, 400);
      }
    }

    const updates: Record<string, unknown> = {};
    if (parseResult.data.data !== undefined) updates.data = parseResult.data.data;
    if (parseResult.data.status !== undefined) updates.status = parseResult.data.status;
    if (parseResult.data.notes !== undefined) updates.notes = parseResult.data.notes;

    if (Object.keys(updates).length === 0) {
      return apiError('No fields to update', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    const { data: updated, error: updateError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .update(updates as never)
      .eq('id', sectionId)
      .eq('vetting_id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating section:', { sectionId, error: updateError });
      return apiError('Failed to update section', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ section: updated });
  } catch (err) {
    logger.error('Unhandled error in PATCH sections/[sectionId]:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
