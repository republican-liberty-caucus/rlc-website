import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { billCreateSchema } from '@/lib/validations/scorecard';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
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

  const { data, error } = await supabase
    .from('rlc_scorecard_bills')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }

  return NextResponse.json({ bills: data || [] });
}

export async function POST(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = billCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const supabase = createServerClient();

  // Verify session exists
  const { data: session, error: sessionError } = await supabase
    .from('rlc_scorecard_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('rlc_scorecard_bills')
    .insert({
      id: crypto.randomUUID(),
      session_id: sessionId,
      legiscan_bill_id: input.legiscanBillId || null,
      bill_number: input.billNumber,
      title: input.title,
      description: input.description || null,
      liberty_position: input.libertyPosition,
      category: input.category || 'other',
      weight: input.weight || 1,
      vote_date: input.voteDate || null,
      bill_status: 'tracking',
      legiscan_roll_call_id: input.legiscanRollCallId || null,
    } as never)
    .select()
    .single();

  if (error) {
    logger.error('Error adding bill:', error);
    return NextResponse.json({ error: 'Failed to add bill' }, { status: 500 });
  }

  return NextResponse.json({ bill: data }, { status: 201 });
}
