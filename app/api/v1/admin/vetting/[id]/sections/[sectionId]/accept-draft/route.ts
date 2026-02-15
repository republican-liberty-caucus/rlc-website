import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canEditSection } from '@/lib/vetting/permissions';
import { sectionAcceptDraftSchema } from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';
import type { VettingSectionStatus } from '@/types';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

/** Deep merge b into a. Arrays are replaced, not concatenated. */
function deepMerge(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    const aVal = a[key];
    const bVal = b[key];
    if (
      typeof aVal === 'object' && typeof bVal === 'object' &&
      aVal !== null && bVal !== null &&
      !Array.isArray(aVal) && !Array.isArray(bVal)
    ) {
      result[key] = deepMerge(
        aVal as Record<string, unknown>,
        bVal as Record<string, unknown>
      );
    } else {
      result[key] = bVal;
    }
  }
  return result;
}

export async function POST(request: Request, { params }: RouteParams) {
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

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — defaults apply
    }

    const parseResult = sectionAcceptDraftSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    const { mergeStrategy } = parseResult.data;

    // Fetch section with assignments and current data
    interface SectionRow {
      id: string;
      vetting_id: string;
      status: VettingSectionStatus;
      data: Record<string, unknown> | null;
      ai_draft_data: Record<string, unknown> | null;
      assignments: { committee_member_id: string }[];
    }

    const { data: rawSection, error: fetchError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select(`
        id, vetting_id, status, data, ai_draft_data,
        assignments:rlc_candidate_vetting_section_assignments(committee_member_id)
      `)
      .eq('id', sectionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error fetching section for accept-draft:', { sectionId, error: fetchError });
      return apiError('Failed to fetch section', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const section = rawSection as unknown as SectionRow;

    if (section.vetting_id !== id) {
      return apiError('Section not found', ApiErrorCode.NOT_FOUND, 404);
    }

    // Permission check
    const assignedMemberIds = (section.assignments ?? []).map((a) => a.committee_member_id);
    if (!canEditSection(ctx, assignedMemberIds)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }

    // Must have an AI draft to accept
    if (!section.ai_draft_data) {
      return apiError('No AI draft to accept', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    // Build the new data
    let newData: Record<string, unknown>;
    if (mergeStrategy === 'merge' && section.data) {
      newData = deepMerge(section.data, section.ai_draft_data);
    } else {
      newData = { ...section.ai_draft_data };
    }

    // Auto-advance status if still in early stages
    let newStatus: VettingSectionStatus | undefined;
    if (section.status === 'section_not_started' || section.status === 'section_assigned') {
      newStatus = 'section_in_progress';
    }

    const updates: Record<string, unknown> = { data: newData };
    if (newStatus) {
      updates.status = newStatus;
    }

    const { data: updated, error: updateError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .update(updates as never)
      .eq('id', sectionId)
      .eq('vetting_id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error accepting AI draft:', { sectionId, error: updateError });
      return apiError('Failed to accept AI draft', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({ section: updated });
  } catch (err) {
    logger.error('Unhandled error in POST accept-draft:', err);
    return apiError('An unexpected error occurred', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
