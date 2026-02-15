import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageDeadlines } from '@/lib/vetting/permissions';
import { electionDeadlineCreateSchema } from '@/lib/validations/vetting';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
  }

  const ctx = await getVettingContext(userId);
  if (!ctx) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  const supabase = createServerClient();
  const { searchParams } = request.nextUrl;
  const stateCode = searchParams.get('stateCode');
  const cycleYear = searchParams.get('cycleYear');

  let query = supabase
    .from('rlc_candidate_election_deadlines')
    .select('*')
    .order('state_code', { ascending: true })
    .order('cycle_year', { ascending: false });

  if (stateCode) {
    query = query.eq('state_code', stateCode.toUpperCase());
  }
  if (cycleYear) {
    query = query.eq('cycle_year', parseInt(cycleYear, 10));
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching election deadlines:', error);
    return apiError('Failed to fetch deadlines', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ deadlines: data || [] });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageDeadlines(ctx)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = electionDeadlineCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_election_deadlines')
    .insert({
      id: crypto.randomUUID(),
      state_code: input.stateCode,
      cycle_year: input.cycleYear,
      office_type: input.officeType,
      primary_date: input.primaryDate || null,
      primary_runoff_date: input.primaryRunoffDate || null,
      general_date: input.generalDate || null,
      general_runoff_date: input.generalRunoffDate || null,
      filing_deadline: input.filingDeadline || null,
      notes: input.notes || null,
    } as never)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return apiError('A deadline for this state/year/office already exists', ApiErrorCode.CONFLICT, 409);
    }
    logger.error('Error creating election deadline:', error);
    return apiError('Failed to create deadline', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ deadline: data }, { status: 201 });
}
