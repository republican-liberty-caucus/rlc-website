import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { campaignUpdateSchema } from '@/lib/validations/campaign';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServerClient();
  const { searchParams } = request.nextUrl;
  const include = searchParams.get('include');

  const { data: campaign, error } = await supabase
    .from('rlc_action_campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result: Record<string, unknown> = { campaign };

  if (include === 'participations') {
    const { data: participations } = await supabase
      .from('rlc_campaign_participations')
      .select('id, action, legislator_id, created_at, contact_id')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    // Fetch member names for participations
    const memberIds = [...new Set((participations || []).map((p: { contact_id: string }) => p.contact_id))];
    let membersMap: Record<string, { full_name: string; email: string }> = {};

    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from('rlc_members')
        .select('id, full_name, email')
        .in('id', memberIds);

      membersMap = Object.fromEntries(
        ((members || []) as { id: string; full_name: string; email: string }[]).map(m => [m.id, { full_name: m.full_name, email: m.email }])
      );
    }

    result.participations = (participations || []).map((p: { id: string; action: string; legislator_id: string | null; created_at: string; contact_id: string }) => ({
      id: p.id,
      action: p.action,
      legislator_id: p.legislator_id,
      created_at: p.created_at,
      member: membersMap[p.contact_id] || null,
    }));
  }

  return NextResponse.json(result);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = campaignUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const { id } = await params;
  const supabase = createServerClient();

  const updateFields: Record<string, unknown> = {};
  if (input.title !== undefined) updateFields.title = input.title;
  if (input.slug !== undefined) updateFields.slug = input.slug;
  if (input.description !== undefined) updateFields.description = input.description;
  if (input.billId !== undefined) updateFields.bill_id = input.billId;
  if (input.charterId !== undefined) updateFields.charter_id = input.charterId;
  if (input.targetChamber !== undefined) updateFields.target_chamber = input.targetChamber;
  if (input.targetStateCode !== undefined) updateFields.target_state_code = input.targetStateCode;
  if (input.messageTemplate !== undefined) updateFields.message_template = input.messageTemplate;
  if (input.status !== undefined) updateFields.status = input.status;
  if (input.startsAt !== undefined) updateFields.starts_at = input.startsAt;
  if (input.endsAt !== undefined) updateFields.ends_at = input.endsAt;

  const { data, error } = await supabase
    .from('rlc_action_campaigns')
    .update(updateFields as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A campaign with this slug already exists' }, { status: 409 });
    }
    logger.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
