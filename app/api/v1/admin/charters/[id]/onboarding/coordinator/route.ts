import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  coordinatorId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!ctx.isNational) {
    return NextResponse.json({ error: 'Forbidden: national admin required' }, { status: 403 });
  }

  const { id: charterId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid input', details: parseResult.error.flatten() }, { status: 400 });
  }

  const { coordinatorId } = parseResult.data;

  // Verify member exists
  const { data: member, error: memberError } = await supabase
    .from('rlc_contacts')
    .select('id')
    .eq('id', coordinatorId)
    .single();

  if (memberError || !member) {
    if (memberError && memberError.code !== 'PGRST116') {
      logger.error('Error looking up coordinator member:', memberError);
      return NextResponse.json({ error: 'Failed to verify member' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rlc_charter_onboarding')
    .update({ coordinator_id: coordinatorId })
    .eq('charter_id', charterId)
    .select()
    .single();

  if (error || !data) {
    if (!error || error.code === 'PGRST116') {
      return NextResponse.json({ error: 'No onboarding found for this charter' }, { status: 404 });
    }
    logger.error('Error updating coordinator:', error);
    return NextResponse.json({ error: 'Failed to update coordinator' }, { status: 500 });
  }

  return NextResponse.json({ onboarding: data });
}
