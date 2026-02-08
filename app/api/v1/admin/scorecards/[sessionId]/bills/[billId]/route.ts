import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { billUpdateSchema } from '@/lib/validations/scorecard';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; billId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { billId } = await params;
  const supabase = createServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('rlc_scorecard_bills')
    .select('id')
    .eq('id', billId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = billUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.billNumber !== undefined) updatePayload.bill_number = input.billNumber;
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.description !== undefined) updatePayload.description = input.description || null;
  if (input.libertyPosition !== undefined) updatePayload.liberty_position = input.libertyPosition;
  if (input.aiSuggestedPosition !== undefined) updatePayload.ai_suggested_position = input.aiSuggestedPosition;
  if (input.aiAnalysis !== undefined) updatePayload.ai_analysis = input.aiAnalysis || null;
  if (input.category !== undefined) updatePayload.category = input.category;
  if (input.weight !== undefined) updatePayload.weight = input.weight;
  if (input.voteDate !== undefined) updatePayload.vote_date = input.voteDate || null;
  if (input.billStatus !== undefined) updatePayload.bill_status = input.billStatus;
  if (input.legiscanRollCallId !== undefined) updatePayload.legiscan_roll_call_id = input.legiscanRollCallId || null;

  const { data, error } = await supabase
    .from('rlc_scorecard_bills')
    .update(updatePayload as never)
    .eq('id', billId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating bill:', error);
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }

  return NextResponse.json({ bill: data });
}
