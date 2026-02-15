import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode } from '@/lib/api/errors';

// DELETE /api/v1/me/household/[id] — remove a household member
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
    }

    // Check household exists before checking role
    if (!member.household_id) {
      return apiError('No household found', ApiErrorCode.NOT_FOUND, 404);
    }

    // Only primary members can remove household members
    if (member.household_role !== 'primary') {
      return apiError('Only the primary household member can remove family members', ApiErrorCode.FORBIDDEN, 403);
    }

    const { id: targetId } = await params;

    // Cannot remove yourself
    if (targetId === member.id) {
      return apiError('Cannot remove the primary household member', ApiErrorCode.VALIDATION_ERROR, 400);
    }

    const supabase = createServerClient();

    // Verify the target member is in the same household
    const { data: targetData, error: lookupError } = await supabase
      .from('rlc_contacts')
      .select('id, email, household_id, household_role, first_name, last_name, membership_tier')
      .eq('id', targetId)
      .single();

    if (lookupError) {
      if (lookupError.code === 'PGRST116') {
        return apiError('Household member not found', ApiErrorCode.NOT_FOUND, 404);
      }
      logger.error('Error looking up household member:', lookupError);
      return apiError('Failed to find household member', ApiErrorCode.INTERNAL_ERROR, 500);
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
      return apiError('Member is not in your household', ApiErrorCode.FORBIDDEN, 403);
    }

    // Clear household fields and cancel membership
    const { error: updateError } = await supabase
      .from('rlc_contacts')
      .update({
        household_id: null,
        household_role: null,
        primary_contact_id: null,
        membership_status: 'cancelled',
      } as never)
      .eq('id', targetId);

    if (updateError) {
      logger.error('Error removing household member:', updateError);
      return apiError('Failed to remove household member', ApiErrorCode.INTERNAL_ERROR, 500);
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
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
