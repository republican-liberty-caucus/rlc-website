import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { sessionCreateSchema } from '@/lib/validations/scorecard';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = sessionCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;

  const { data, error } = await supabase
    .from('rlc_scorecard_sessions')
    .insert({
      id: crypto.randomUUID(),
      name: input.name,
      slug: input.slug,
      jurisdiction: input.jurisdiction || 'federal',
      state_code: input.stateCode || null,
      charter_id: input.charterId || null,
      session_year: input.sessionYear,
      status: 'draft',
      created_by: ctx.member.id,
    } as never)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return apiError('A session with this slug already exists', ApiErrorCode.CONFLICT, 409);
    }
    logger.error('Error creating scorecard session:', error);
    return apiError('Failed to create session', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ session: data }, { status: 201 });
}
