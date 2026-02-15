import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { sessionCreateSchema } from '@/lib/validations/scorecard';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = sessionCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
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
      return NextResponse.json({ error: 'A session with this slug already exists' }, { status: 409 });
    }
    logger.error('Error creating scorecard session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  return NextResponse.json({ session: data }, { status: 201 });
}
