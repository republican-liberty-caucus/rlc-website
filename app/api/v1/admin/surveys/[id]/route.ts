import { NextResponse } from 'next/server';
import { surveyUpdateSchema } from '@/lib/validations/survey';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { supabase } = result;

  const { id } = await params;

  const { data: existingData, error: fetchError } = await supabase
    .from('rlc_surveys')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingData) {
    return apiError('Survey not found', ApiErrorCode.NOT_FOUND, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = surveyUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.slug !== undefined) updatePayload.slug = input.slug;
  if (input.description !== undefined) updatePayload.description = input.description || null;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.electionType !== undefined) updatePayload.election_type = input.electionType || null;
  if (input.primaryDate !== undefined) updatePayload.primary_date = input.primaryDate || null;
  if (input.generalDate !== undefined) updatePayload.general_date = input.generalDate || null;
  if (input.state !== undefined) updatePayload.state = input.state || null;
  if (input.charterId !== undefined) updatePayload.charter_id = input.charterId || null;
  if (input.officeTypeId !== undefined) updatePayload.office_type_id = input.officeTypeId || null;
  if (input.electionDeadlineId !== undefined) updatePayload.election_deadline_id = input.electionDeadlineId || null;

  const { data, error } = await supabase
    .from('rlc_surveys')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating survey:', error);
    return apiError('Failed to update survey', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ survey: data });
}
