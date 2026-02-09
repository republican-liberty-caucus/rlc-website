import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import { logger } from '@/lib/logger';

// DELETE /api/v1/me/household/[id] — remove a household member
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Check household exists before checking role
    if (!member.household_id) {
      return NextResponse.json({ error: 'No household found' }, { status: 404 });
    }

    // Only primary members can remove household members
    if (member.household_role !== 'primary') {
      return NextResponse.json(
        { error: 'Only the primary household member can remove family members' },
        { status: 403 }
      );
    }

    const { id: targetId } = await params;

    // Cannot remove yourself
    if (targetId === member.id) {
      return NextResponse.json(
        { error: 'Cannot remove the primary household member' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify the target member is in the same household
    const { data: targetData, error: lookupError } = await supabase
      .from('rlc_members')
      .select('id, email, household_id, household_role, first_name, last_name, membership_tier')
      .eq('id', targetId)
      .single();

    if (lookupError) {
      if (lookupError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Household member not found' }, { status: 404 });
      }
      logger.error('Error looking up household member:', lookupError);
      return NextResponse.json({ error: 'Failed to find household member' }, { status: 500 });
    }

    const targetMember = targetData as {
      id: string;
      email: string;
      household_id: string | null;
      household_role: string | null;
      first_name: string;
      last_name: string;
      membership_tier: string;
    };

    if (targetMember.household_id !== member.household_id) {
      return NextResponse.json({ error: 'Member is not in your household' }, { status: 403 });
    }

    // Clear household fields and cancel membership
    const { error: updateError } = await supabase
      .from('rlc_members')
      .update({
        household_id: null,
        household_role: null,
        primary_contact_id: null,
        membership_status: 'cancelled',
      } as never)
      .eq('id', targetId);

    if (updateError) {
      logger.error('Error removing household member:', updateError);
      return NextResponse.json({ error: 'Failed to remove household member' }, { status: 500 });
    }

    // Sync cancelled status to HighLevel (non-fatal)
    try {
      await syncMemberToHighLevel({
        id: targetId,
        email: targetMember.email,
        firstName: targetMember.first_name,
        lastName: targetMember.last_name,
        membershipTier: targetMember.membership_tier,
        membershipStatus: 'cancelled',
      });
    } catch (hlError) {
      logger.error(`HighLevel sync failed for removed household member ${targetId} (non-fatal):`, hlError);
    }

    logger.info(
      `Household member removed: ${targetId} (${targetMember.first_name} ${targetMember.last_name}) ` +
      `from household ${member.household_id} by ${member.id}`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Unexpected error in DELETE /api/v1/me/household/[id]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
