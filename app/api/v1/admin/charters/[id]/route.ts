import { NextResponse } from 'next/server';
import { charterUpdateSchema } from '@/lib/validations/admin';
import type { Database } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';

type CharterUpdate = Database['public']['Tables']['rlc_charters']['Update'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id } = await params;

  // Check charter visibility
  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parseResult = charterUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  const updatePayload: CharterUpdate = {};
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.contactEmail !== undefined) updatePayload.contact_email = input.contactEmail;
  if (input.websiteUrl !== undefined) updatePayload.website_url = input.websiteUrl;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.contactPhone !== undefined) updatePayload.contact_phone = input.contactPhone;
  if (input.facebookUrl !== undefined) updatePayload.facebook_url = input.facebookUrl;
  if (input.twitterUrl !== undefined) updatePayload.twitter_url = input.twitterUrl;
  if (input.bylawsUrl !== undefined) updatePayload.bylaws_url = input.bylawsUrl;

  const { data, error } = await supabase
    .from('rlc_charters')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating charter:', error);
    return NextResponse.json({ error: 'Failed to update charter' }, { status: 500 });
  }

  return NextResponse.json({ charter: data });
}
