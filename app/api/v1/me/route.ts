import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = await getMemberByClerkId(userId);

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json({ member });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = await getMemberByClerkId(userId);

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      emailOptIn,
      smsOptIn,
    } = body;

    const supabase = createServerClient();

    const updatePayload = {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      postal_code: postalCode || null,
      email_opt_in: emailOptIn,
      sms_opt_in: smsOptIn,
    };

    // @ts-expect-error - Supabase types not generated for this table
    const { data, error } = await supabase
      .from('rlc_members')
      .update(updatePayload)
      .eq('id', member.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const updatedMember = data as typeof member;

    // Sync updated info to HighLevel
    try {
      await syncMemberToHighLevel({
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
    } catch (hlError) {
      console.error('Failed to sync to HighLevel:', hlError);
      // Don't fail the request if HighLevel sync fails
    }

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
