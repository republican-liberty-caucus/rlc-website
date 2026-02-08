import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId, upsertMemberFromClerk } from '@/lib/supabase/server';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import type { Database } from '@/lib/supabase/client';
import { z } from 'zod';

type MemberUpdate = Database['public']['Tables']['rlc_members']['Update'];

// Input validation schema for profile updates
const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
});

// Get existing member or auto-create from Clerk user data
async function getOrCreateMember(clerkUserId: string) {
  const existing = await getMemberByClerkId(clerkUserId);
  if (existing) return existing;

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkUserId);
  return upsertMemberFromClerk({
    id: clerkUser.id,
    email_addresses: clerkUser.emailAddresses.map((e) => ({ email_address: e.emailAddress })),
    first_name: clerkUser.firstName,
    last_name: clerkUser.lastName,
    phone_numbers: clerkUser.phoneNumbers.map((p) => ({ phone_number: p.phoneNumber })),
  });
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const member = await getOrCreateMember(userId);
    return NextResponse.json({ member });
  } catch (error) {
    console.error('Error getting/creating member:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const member = await getOrCreateMember(userId);
    const body = await request.json();

    // Validate input
    const parseResult = profileUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

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
    } = parseResult.data;

    const supabase = createServerClient();

    const updatePayload: MemberUpdate = {
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

    const { data, error } = await supabase
      .from('rlc_members')
      .update(updatePayload as never)
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
