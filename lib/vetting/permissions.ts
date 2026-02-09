import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, getRoleWeight } from '@/lib/admin/permissions';
import type { AdminContext } from '@/lib/admin/permissions';
import type { CommitteeRole } from '@/types';

export interface VettingContext extends AdminContext {
  committeeId: string | null;
  committeeMemberId: string | null;
  committeeRole: CommitteeRole | null;
  isCommitteeMember: boolean;
  isChair: boolean;
}

/**
 * Get the vetting context for a Clerk user.
 * Extends AdminContext with committee membership info.
 * Wrapped in React cache() for per-request deduplication.
 */
export const getVettingContext = cache(async (clerkUserId: string): Promise<VettingContext | null> => {
  const adminCtx = await getAdminContext(clerkUserId);
  if (!adminCtx) return null;

  const supabase = createServerClient();

  // Look up the user's active committee membership
  const { data: rawMembership, error } = await supabase
    .from('rlc_candidate_vetting_committee_members')
    .select('id, committee_id, role')
    .eq('contact_id', adminCtx.member.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch committee membership: ${error.message}`);
  }

  const membership = rawMembership as { id: string; committee_id: string; role: CommitteeRole } | null;

  return {
    ...adminCtx,
    committeeId: membership?.committee_id ?? null,
    committeeMemberId: membership?.id ?? null,
    committeeRole: membership?.role ?? null,
    isCommitteeMember: !!membership,
    isChair: membership?.role === 'chair',
  };
});

/** Committee members, national board, and super admins can view the pipeline */
export function canViewPipeline(ctx: VettingContext): boolean {
  return ctx.isCommitteeMember || ctx.isNational;
}

/** Committee chair and national can create a vetting from a candidate response */
export function canCreateVetting(ctx: VettingContext): boolean {
  return ctx.isChair || ctx.isNational;
}

/** Only the committee chair can assign sections to members */
export function canAssignSections(ctx: VettingContext): boolean {
  return ctx.isChair || ctx.isNational;
}

/** A member can edit a section if they are assigned to it, or if they are the chair/national */
export function canEditSection(ctx: VettingContext, assignedMemberIds: string[]): boolean {
  if (ctx.isNational || ctx.isChair) return true;
  if (!ctx.committeeMemberId) return false;
  return assignedMemberIds.includes(ctx.committeeMemberId);
}

/** Any active committee member can record interview notes */
export function canRecordInterview(ctx: VettingContext): boolean {
  return ctx.isCommitteeMember || ctx.isNational;
}

/** Only the committee chair can make a recommendation */
export function canMakeRecommendation(ctx: VettingContext): boolean {
  return ctx.isChair || ctx.isNational;
}

/** Only national board and super admin can cast board votes */
export function canCastBoardVote(ctx: VettingContext): boolean {
  return getRoleWeight(ctx.highestRole) >= getRoleWeight('national_board');
}

/** Only national board and super admin can manage committee membership */
export function canManageCommittee(ctx: VettingContext): boolean {
  return ctx.isNational;
}

/** Only national board and super admin can manage election deadlines */
export function canManageDeadlines(ctx: VettingContext): boolean {
  return ctx.isNational;
}
