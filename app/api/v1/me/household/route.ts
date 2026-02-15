import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { getTierConfig } from '@/lib/stripe/client';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import type { MembershipTier,  Contact } from '@/types';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

const addMemberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(200),
  role: z.enum(['spouse', 'child']),
});

// GET /api/v1/me/household — list household members
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
    }

    const supabase = createServerClient();

    // If this member has no household_id, return empty list
    if (!member.household_id) {
      return NextResponse.json({
        data: {
          primaryMember: member,
          householdMembers: [],
          householdId: null,
        },
      });
    }

    // Fetch all members in this household
    const { data: householdMembers, error } = await supabase
      .from('rlc_contacts')
      .select('id, first_name, last_name, email, household_role, membership_tier, membership_status, created_at')
      .eq('household_id', member.household_id)
      .neq('id', member.id)
      .order('household_role')
      .order('created_at');

    if (error) {
      logger.error('Error fetching household members:', error);
      return apiError('Failed to fetch household members', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    return NextResponse.json({
      data: {
        primaryMember: member,
        householdMembers: householdMembers || [],
        householdId: member.household_id,
      },
    });
  } catch (err) {
    logger.error('Unexpected error in GET /api/v1/me/household:', err);
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}

// POST /api/v1/me/household — add a household member
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError('Unauthorized', ApiErrorCode.UNAUTHORIZED, 401);
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
    }

    // Only primary members (or members without household) can add household members
    if (member.household_role && member.household_role !== 'primary') {
      return apiError('Only the primary household member can add family members', ApiErrorCode.FORBIDDEN, 403);
    }

    // Check tier eligibility
    const tierConfig = getTierConfig(member.membership_tier as MembershipTier);
    if (!tierConfig || (!tierConfig.includesSpouse && !tierConfig.includesFamily)) {
      return apiError('Your membership tier does not include household members. Upgrade to Premium or higher.', ApiErrorCode.FORBIDDEN, 403);
    }

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('Invalid JSON body', ApiErrorCode.INVALID_JSON, 400);
    }

    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { firstName, lastName, email, role } = parsed.data;

    // Validate role against tier
    if (role === 'child' && !tierConfig.includesFamily) {
      return apiError('Your membership tier does not include children. Upgrade to Sustaining or higher.', ApiErrorCode.FORBIDDEN, 403);
    }

    const supabase = createServerClient();

    // Get or create household_id (conditional update prevents race condition)
    let householdId = member.household_id;
    if (!householdId) {
      householdId = crypto.randomUUID();
      // Only update if household_id is still null (prevents concurrent creation of different IDs)
      const { data: updatedPrimary, error: updateError } = await supabase
        .from('rlc_contacts')
        .update({
          household_id: householdId,
          household_role: 'primary',
        } as never)
        .eq('id', member.id)
        .is('household_id', null)
        .select('household_id')
        .maybeSingle();

      if (updateError) {
        logger.error('Error setting primary household fields:', updateError);
        return apiError('Failed to initialize household', ApiErrorCode.INTERNAL_ERROR, 500);
      }

      if (!updatedPrimary) {
        // Concurrent request already created the household — use existing ID
        const { data: refreshed } = await supabase
          .from('rlc_contacts')
          .select('household_id')
          .eq('id', member.id)
          .single();
        const refreshedMember = refreshed as { household_id: string | null } | null;
        if (!refreshedMember?.household_id) {
          return apiError('Failed to initialize household', ApiErrorCode.INTERNAL_ERROR, 500);
        }
        householdId = refreshedMember.household_id;
      }
    }

    // Check existing household member counts for limits
    const { data: existingMembers, error: countError } = await supabase
      .from('rlc_contacts')
      .select('id, household_role')
      .eq('household_id', householdId)
      .neq('id', member.id);

    if (countError) {
      logger.error('Error counting household members:', countError);
      return apiError('Failed to check household limits', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const existingMembersList = (existingMembers || []) as Array<{ id: string; household_role: string | null }>;
    const existingSpouses = existingMembersList.filter(m => m.household_role === 'spouse');

    // Premium: max 1 spouse, no children
    // Sustaining+: max 1 spouse, unlimited children
    if (role === 'spouse' && existingSpouses.length >= 1) {
      return apiError('Your household already has a spouse member', ApiErrorCode.CONFLICT, 409);
    }

    // Check if email is already in use
    const { data: existingByEmail, error: emailError } = await supabase
      .from('rlc_contacts')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (emailError && emailError.code !== 'PGRST116') {
      logger.error('Error checking email:', emailError);
      return apiError('Failed to validate email', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    if (existingByEmail) {
      return apiError('A member with this email already exists', ApiErrorCode.CONFLICT, 409);
    }

    // Create the household member record
    const { data: newMember, error: insertError } = await supabase
      .from('rlc_contacts')
      .insert({
        email: email.toLowerCase().trim(),
        first_name: firstName,
        last_name: lastName,
        household_id: householdId,
        household_role: role,
        primary_contact_id: member.id,
        membership_tier: member.membership_tier,
        membership_status: member.membership_status,
        membership_start_date: member.membership_start_date,
        membership_expiry_date: member.membership_expiry_date,
        membership_join_date: new Date().toISOString(),
        country: 'US',
      } as never)
      .select()
      .single();

    if (insertError) {
      // Handle unique partial index violation (concurrent spouse add)
      if (insertError.code === '23505' && insertError.message?.includes('idx_one_spouse_per_household')) {
        return apiError('Your household already has a spouse member', ApiErrorCode.CONFLICT, 409);
      }
      logger.error('Error creating household member:', insertError);
      return apiError('Failed to add household member', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    const created = newMember as Contact;

    // Sync to HighLevel (non-fatal)
    try {
      await syncMemberToHighLevel({
        id: created.id,
        email: created.email,
        firstName: created.first_name,
        lastName: created.last_name,
        phone: created.phone,
        membershipTier: created.membership_tier,
        membershipStatus: created.membership_status,
        membershipStartDate: created.membership_start_date || undefined,
        membershipExpiryDate: created.membership_expiry_date || undefined,
        membershipJoinDate: created.membership_join_date || undefined,
      });
    } catch (hlError) {
      logger.error(`HighLevel sync failed for household member ${created.id} (non-fatal):`, hlError);
    }

    logger.info(`Household member added: ${created.id} (${role}) to household ${householdId} by ${member.id}`);

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    logger.error('Unexpected error in POST /api/v1/me/household:', err);
    return apiError('Internal server error', ApiErrorCode.INTERNAL_ERROR, 500);
  }
}
