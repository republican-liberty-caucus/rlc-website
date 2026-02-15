import { NextResponse } from 'next/server';
import { canViewMember, getRoleWeight } from '@/lib/admin/permissions';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import { logger } from '@/lib/logger';
import type { Database } from '@/lib/supabase/client';
import { adminMemberUpdateSchema } from '@/lib/validations/admin';
import type { Contact } from '@/types';

type MemberUpdate = Database['public']['Tables']['rlc_contacts']['Update'];

// Fields only national_board+ can modify
const RESTRICTED_FIELDS = ['membershipTier', 'membershipStatus', 'primaryCharterId', 'membershipExpiryDate'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id } = await params;

  // Fetch the member to verify the admin can see their charter
  const { data: existing, error: fetchError } = await supabase
    .from('rlc_contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const member = existing as Contact;

  if (!canViewMember(ctx, member.primary_charter_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parseResult = adminMemberUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  // Scoped admins (charter_admin, state_chair) cannot modify restricted fields
  const isNationalPlus = getRoleWeight(ctx.highestRole) >= getRoleWeight('national_board');
  if (!isNationalPlus) {
    for (const field of RESTRICTED_FIELDS) {
      if (input[field] !== undefined) {
        return NextResponse.json(
          { error: `Only national_board+ can modify ${field}` },
          { status: 403 }
        );
      }
    }
  }

  // If changing primaryCharterId, verify the new charter is also in admin's scope
  if (input.primaryCharterId !== undefined && ctx.visibleCharterIds !== null) {
    if (input.primaryCharterId !== null && !ctx.visibleCharterIds.includes(input.primaryCharterId)) {
      return NextResponse.json(
        { error: 'Cannot move member to a charter outside your scope' },
        { status: 403 }
      );
    }
  }

  const updatePayload: MemberUpdate = {};
  if (input.firstName !== undefined) updatePayload.first_name = input.firstName;
  if (input.lastName !== undefined) updatePayload.last_name = input.lastName;
  if (input.email !== undefined) updatePayload.email = input.email;
  if (input.phone !== undefined) updatePayload.phone = input.phone || null;
  if (input.addressLine1 !== undefined) updatePayload.address_line1 = input.addressLine1 || null;
  if (input.addressLine2 !== undefined) updatePayload.address_line2 = input.addressLine2 || null;
  if (input.city !== undefined) updatePayload.city = input.city || null;
  if (input.state !== undefined) updatePayload.state = input.state || null;
  if (input.postalCode !== undefined) updatePayload.postal_code = input.postalCode || null;
  if (input.membershipTier !== undefined) updatePayload.membership_tier = input.membershipTier;
  if (input.membershipStatus !== undefined) updatePayload.membership_status = input.membershipStatus;
  if (input.primaryCharterId !== undefined) updatePayload.primary_charter_id = input.primaryCharterId;
  if (input.membershipExpiryDate !== undefined) updatePayload.membership_expiry_date = input.membershipExpiryDate;
  if (input.emailOptIn !== undefined) updatePayload.email_opt_in = input.emailOptIn;
  if (input.smsOptIn !== undefined) updatePayload.sms_opt_in = input.smsOptIn;
  if (input.doNotPhone !== undefined) updatePayload.do_not_phone = input.doNotPhone;

  const { data, error } = await supabase
    .from('rlc_contacts')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating member:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  const updatedMember = data as Contact;

  // Sync to HighLevel (non-fatal — report warning if it fails)
  let warnings: string[] | undefined;
  try {
    const hlResult = await syncMemberToHighLevel({
      id: updatedMember.id,
      email: updatedMember.email,
      firstName: updatedMember.first_name,
      lastName: updatedMember.last_name,
      phone: updatedMember.phone,
      addressLine1: updatedMember.address_line1,
      city: updatedMember.city,
      state: updatedMember.state,
      postalCode: updatedMember.postal_code,
      membershipTier: updatedMember.membership_tier,
      membershipStatus: updatedMember.membership_status,
    });
    if (!hlResult.success) {
      logger.error('Failed to sync to HighLevel:', hlResult.error);
      warnings = ['HighLevel sync failed — CRM data may be stale'];
    }
  } catch (hlError) {
    logger.error('Failed to sync to HighLevel:', hlError);
    warnings = ['HighLevel sync failed — CRM data may be stale'];
  }

  return NextResponse.json({ member: updatedMember, ...(warnings && { warnings }) });
}
