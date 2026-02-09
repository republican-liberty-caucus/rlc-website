import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { campaignCreateSchema } from '@/lib/validations/campaign';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');

  let query = supabase
    .from('rlc_action_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    query = query.in('charter_id', ctx.visibleCharterIds);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }

  return NextResponse.json({ campaigns: data || [] });
}

export async function POST(request: Request) {
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

  const parseResult = campaignCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const supabase = createServerClient();
  const member = await getMemberByClerkId(userId);

  const { data, error } = await supabase
    .from('rlc_action_campaigns')
    .insert({
      id: crypto.randomUUID(),
      title: input.title,
      slug: input.slug,
      description: input.description || null,
      bill_id: input.billId || null,
      charter_id: input.charterId || null,
      target_chamber: input.targetChamber || null,
      target_state_code: input.targetStateCode || null,
      message_template: input.messageTemplate || null,
      status: 'draft',
      created_by: member?.id || null,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
    } as never)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A campaign with this slug already exists' }, { status: 409 });
    }
    logger.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }

  return NextResponse.json({ campaign: data }, { status: 201 });
}
