import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageCommittee } from '@/lib/vetting/permissions';
import { committeeCreateSchema } from '@/lib/validations/vetting';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getVettingContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Fetch active committee with members
  const { data: committees, error } = await supabase
    .from('rlc_candidate_vetting_committees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error fetching committees:', error);
    return NextResponse.json({ error: 'Failed to fetch committees' }, { status: 500 });
  }

  // Fetch members for each committee with contact info
  const committeeIds = (committees || []).map((c: { id: string }) => c.id);
  let members: unknown[] = [];

  if (committeeIds.length > 0) {
    const { data: memberData, error: memberError } = await supabase
      .from('rlc_candidate_vetting_committee_members')
      .select('*, contact:rlc_members(id, first_name, last_name, email)')
      .in('committee_id', committeeIds)
      .order('role', { ascending: true });

    if (memberError) {
      logger.error('Error fetching committee members:', memberError);
    } else {
      members = memberData || [];
    }
  }

  return NextResponse.json({ committees: committees || [], members });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getVettingContext(userId);
  if (!ctx || !canManageCommittee(ctx)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = committeeCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_vetting_committees')
    .insert({
      id: crypto.randomUUID(),
      name: parseResult.data.name,
      is_active: true,
    } as never)
    .select()
    .single();

  if (error) {
    logger.error('Error creating committee:', error);
    return NextResponse.json({ error: 'Failed to create committee' }, { status: 500 });
  }

  return NextResponse.json({ committee: data }, { status: 201 });
}
