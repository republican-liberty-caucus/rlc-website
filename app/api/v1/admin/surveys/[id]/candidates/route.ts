import { NextResponse } from 'next/server';
import { candidateCreateSchema } from '@/lib/validations/survey';
import { findOrCreateCandidateContact } from '@/lib/vetting/candidate-contact';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { supabase } = result;

  const { id: surveyId } = await params;

  // Verify survey exists
  const { data: survey, error: surveyError } = await supabase
    .from('rlc_surveys')
    .select('id, status')
    .eq('id', surveyId)
    .single();

  if (surveyError || !survey) {
    return apiError('Survey not found', ApiErrorCode.NOT_FOUND, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = candidateCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;

  // Verify office type exists and is active if provided
  if (input.officeTypeId) {
    const { data: officeType, error: otError } = await supabase
      .from('rlc_office_types')
      .select('id, is_active')
      .eq('id', input.officeTypeId)
      .single();

    if (otError || !officeType) {
      return apiError('Invalid office type', ApiErrorCode.VALIDATION_ERROR, 400);
    }
    const ot = officeType as unknown as { id: string; is_active: boolean };
    if (!ot.is_active) {
      return apiError('Office type is inactive', ApiErrorCode.VALIDATION_ERROR, 400);
    }
  }

  const accessToken = crypto.randomBytes(32).toString('hex');

  // Tokens expire in 90 days (issue #55)
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 90);

  // Link candidate to contact record
  let contactId: string | null = null;
  try {
    const contactResult = await findOrCreateCandidateContact({
      candidateFirstName: input.candidateFirstName,
      candidateLastName: input.candidateLastName,
      candidateEmail: input.candidateEmail,
      candidateState: input.candidateState,
    });
    contactId = contactResult.contactId;
  } catch (err) {
    logger.error('Failed to link candidate to contact (non-blocking):', err);
  }

  const { data: candidate, error: insertError } = await supabase
    .from('rlc_candidate_responses')
    .insert({
      id: crypto.randomUUID(),
      survey_id: surveyId,
      contact_id: contactId,
      candidate_first_name: input.candidateFirstName,
      candidate_last_name: input.candidateLastName,
      candidate_email: input.candidateEmail || null,
      candidate_party: input.candidateParty || null,
      candidate_office: input.candidateOffice || null,
      candidate_district: input.candidateDistrict || null,
      office_type_id: input.officeTypeId || null,
      candidate_state: input.candidateState || null,
      candidate_county: input.candidateCounty || null,
      access_token: accessToken,
      token_expires_at: tokenExpiresAt.toISOString(),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (insertError) {
    logger.error('Error adding candidate:', insertError);
    return apiError('Failed to add candidate', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ candidate, accessToken }, { status: 201 });
}
