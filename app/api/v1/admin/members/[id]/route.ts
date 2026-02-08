import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, canViewMember, getRoleWeight } from '@/lib/admin/permissions';
import { adminMemberUpdateSchema } from '@/lib/validations/admin';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import type { Member } from '@/types';
import type { Database } from '@/lib/supabase/client';

type MemberUpdate = Database['public']['Tables']['rlc_members']['Update'];

// Fields only national_board+ can modify
const RESTRICTED_FIELDS = ['membershipTier', 'membershipStatus', 'primaryChapterId', 'membershipExpiryDate'] as const;

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

  const { id } = await params;
  const supabase = createServerClient();

  // Fetch the member to verify the admin can see their chapter
  const { data: existing, error: fetchError } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const member = existing as Member;

  if (!canViewMember(ctx, member.primary_chapter_id)) {
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

  // Scoped admins (chapter_admin, state_chair) cannot modify restricted fields
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

  // If changing primaryChapterId, verify the new chapter is also in admin's scope
  if (input.primaryChapterId !== undefined && ctx.visibleChapterIds !== null) {
    if (input.primaryChapterId !== null && !ctx.visibleChapterIds.includes(input.primaryChapterId)) {
      return NextResponse.json(
        { error: 'Cannot move member to a chapter outside your scope' },
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
  if (input.primaryChapterId !== undefined) updatePayload.primary_chapter_id = input.primaryChapterId;
  if (input.membershipExpiryDate !== undefined) updatePayload.membership_expiry_date = input.membershipExpiryDate;
  if (input.emailOptIn !== undefined) updatePayload.email_opt_in = input.emailOptIn;
  if (input.smsOptIn !== undefined) updatePayload.sms_opt_in = input.smsOptIn;
  if (input.doNotPhone !== undefined) updatePayload.do_not_phone = input.doNotPhone;

  const { data, error } = await supabase
    .from('rlc_members')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating member:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  const updatedMember = data as Member;

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
      console.error('Failed to sync to HighLevel:', hlResult.error);
      warnings = ['HighLevel sync failed — CRM data may be stale'];
    }
  } catch (hlError) {
    console.error('Failed to sync to HighLevel:', hlError);
    warnings = ['HighLevel sync failed — CRM data may be stale'];
  }

  return NextResponse.json({ member: updatedMember, ...(warnings && { warnings }) });
}
