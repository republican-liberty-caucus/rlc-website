import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageCommittee } from '@/lib/vetting/permissions';
import { committeeMemberAddSchema } from '@/lib/validations/vetting';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

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

  const parseResult = committeeMemberAddSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { contactId, role } = parseResult.data;

  // Need a committeeId — get the first active committee (or from request body)
  const committeeId = (body as Record<string, unknown>).committeeId as string | undefined;
  if (!committeeId) {
    return NextResponse.json({ error: 'committeeId is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_vetting_committee_members')
    .insert({
      id: crypto.randomUUID(),
      committee_id: committeeId,
      contact_id: contactId,
      role: role || 'committee_member',
      is_active: true,
    } as never)
    .select('*, contact:rlc_contacts(id, first_name, last_name, email)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Member is already on this committee' }, { status: 409 });
    }
    logger.error('Error adding committee member:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }

  return NextResponse.json({ member: data }, { status: 201 });
}
