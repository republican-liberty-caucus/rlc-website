import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { sessionUpdateSchema } from '@/lib/validations/scorecard';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId } = await params;
  const supabase = createServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('rlc_scorecard_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = sessionUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.slug !== undefined) updatePayload.slug = input.slug;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.jurisdiction !== undefined) updatePayload.jurisdiction = input.jurisdiction;
  if (input.stateCode !== undefined) updatePayload.state_code = input.stateCode || null;
  if (input.charterId !== undefined) updatePayload.charter_id = input.charterId || null;
  if (input.sessionYear !== undefined) updatePayload.session_year = input.sessionYear;

  const { data, error } = await supabase
    .from('rlc_scorecard_sessions')
    .update(updatePayload as never)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }

  return NextResponse.json({ session: data });
}
