import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { participationCreateSchema } from '@/lib/validations/campaign';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = await getMemberByClerkId(userId);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = participationCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const { id } = await params;
  const supabase = createServerClient();

  // Verify campaign exists and is active
  const { data: campaign, error: campaignError } = await supabase
    .from('rlc_action_campaigns')
    .select('id, status')
    .eq('id', id)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const campaignRow = campaign as { id: string; status: string };
  if (campaignRow.status !== 'active') {
    return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('rlc_campaign_participations')
    .insert({
      id: crypto.randomUUID(),
      campaign_id: id,
      contact_id: member.id,
      action: input.action,
      legislator_id: input.legislatorId || null,
      metadata: input.metadata || {},
    } as never)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already participated with this action' }, { status: 409 });
    }
    logger.error('Error logging participation:', error);
    return NextResponse.json({ error: 'Failed to log participation' }, { status: 500 });
  }

  return NextResponse.json({ participation: data }, { status: 201 });
}
