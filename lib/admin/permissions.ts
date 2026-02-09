import { cache } from 'react';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { VALID_MEMBERSHIP_STATUSES, VALID_MEMBERSHIP_TIERS } from '@/lib/validations/admin';
import type { Contact, UserRole, Charter } from '@/types';

// Role hierarchy: higher index = more privilege
const ROLE_HIERARCHY: UserRole[] = [
  'member',
  'chapter_officer',
  'chapter_admin',
  'state_chair',
  'regional_coordinator',
  'national_board',
  'super_admin',
];

// Minimum role that grants admin panel access
const ADMIN_ROLES: UserRole[] = [
  'chapter_admin',
  'state_chair',
  'regional_coordinator',
  'national_board',
  'super_admin',
];

export interface AdminRole {
  id: string;
  role: UserRole;
  charter_id: string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
}

export interface AdminContext {
  member: Contact;
  roles: AdminRole[];
  highestRole: UserRole;
  /** null = national admin, sees everything; string[] = scoped charter IDs */
  visibleCharterIds: string[] | null;
  isNational: boolean;
}

export function getRoleWeight(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function getHighestRole(roles: AdminRole[]): UserRole {
  if (roles.length === 0) return 'member';
  return roles.reduce<UserRole>((highest, r) =>
    getRoleWeight(r.role) > getRoleWeight(highest) ? r.role : highest,
    'member'
  );
}

export function canManageRoles(ctx: AdminContext): boolean {
  return getRoleWeight(ctx.highestRole) >= getRoleWeight('national_board');
}

/** Returns true if the admin can view a member with the given primary_charter_id */
export function canViewMember(ctx: AdminContext, primaryCharterId: string | null): boolean {
  if (ctx.visibleCharterIds === null) return true;
  if (!primaryCharterId) return false;
  return ctx.visibleCharterIds.includes(primaryCharterId);
}

interface MemberFilterParams {
  search?: string | null;
  status?: string | null;
  tier?: string | null;
  source?: string | null;
  joined_after?: string | null;
  joined_before?: string | null;
}

/** Apply standard member list filters (charter scoping, search, status, tier, source) to a Supabase query builder. */
export function applyMemberFilters<T extends { in: (col: string, vals: string[]) => T; or: (filter: string) => T; eq: (col: string, val: string) => T; is: (col: string, val: null) => T; not: (col: string, op: string, val: null) => T; gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
  query: T,
  visibleCharterIds: string[] | null,
  filters: MemberFilterParams
): T {
  if (visibleCharterIds !== null && visibleCharterIds.length > 0) {
    query = query.in('primary_charter_id', visibleCharterIds);
  }
  if (filters.search) {
    const safe = sanitizeSearch(filters.search);
    query = query.or(`email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`);
  }
  if (filters.status && (VALID_MEMBERSHIP_STATUSES as readonly string[]).includes(filters.status)) {
    query = query.eq('membership_status', filters.status);
  }
  if (filters.tier && (VALID_MEMBERSHIP_TIERS as readonly string[]).includes(filters.tier)) {
    query = query.eq('membership_tier', filters.tier);
  }
  if (filters.source) {
    if (filters.source === 'highlevel') {
      query = query.not('highlevel_contact_id', 'is', null);
    } else if (filters.source === 'civicrm') {
      query = query.not('civicrm_contact_id', 'is', null);
    } else if (filters.source === 'both') {
      query = query.not('highlevel_contact_id', 'is', null).not('civicrm_contact_id', 'is', null);
    } else if (filters.source === 'highlevel_only') {
      query = query.not('highlevel_contact_id', 'is', null).is('civicrm_contact_id', null);
    } else if (filters.source === 'civicrm_only') {
      query = query.not('civicrm_contact_id', 'is', null).is('highlevel_contact_id', null);
    }
  }
  if (filters.joined_after && /^\d{4}-\d{2}-\d{2}$/.test(filters.joined_after)) {
    query = query.gte('membership_join_date', filters.joined_after);
  }
  if (filters.joined_before && /^\d{4}-\d{2}-\d{2}$/.test(filters.joined_before)) {
    query = query.lte('membership_join_date', filters.joined_before);
  }
  return query;
}

/**
 * Sanitize a search string for use in PostgREST ilike filters.
 * Escapes characters that have special meaning in PostgREST filter DSL and LIKE patterns.
 */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/\\/g, '\\\\')  // escape backslashes first
    .replace(/%/g, '\\%')    // escape LIKE wildcard %
    .replace(/_/g, '\\_')    // escape LIKE wildcard _
    .replace(/,/g, '')       // strip commas (PostgREST OR separator)
    .replace(/\(/g, '')      // strip parens (PostgREST grouping)
    .replace(/\)/g, '');
}

/**
 * Build the set of charter IDs visible to a scoped admin.
 * Walks the charter tree downward from each role's charter_id,
 * collecting all descendant charter IDs.
 */
function buildVisibleCharterIds(
  roles: AdminRole[],
  charters: Pick<Charter, 'id' | 'parent_charter_id'>[]
): string[] {
  const charterIdSet = new Set(charters.map((ch) => ch.id));

  // Build parent→children map
  const childrenMap = new Map<string, string[]>();
  for (const ch of charters) {
    if (ch.parent_charter_id) {
      const siblings = childrenMap.get(ch.parent_charter_id) || [];
      siblings.push(ch.id);
      childrenMap.set(ch.parent_charter_id, siblings);
    }
  }

  // Collect all descendant IDs from each role's charter_id
  const visibleSet = new Set<string>();
  for (const role of roles) {
    if (!role.charter_id) continue;
    // Skip roles referencing deleted charters
    if (!charterIdSet.has(role.charter_id)) continue;
    const stack = [role.charter_id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      visibleSet.add(current);
      const children = childrenMap.get(current) || [];
      for (const child of children) {
        if (!visibleSet.has(child)) {
          stack.push(child);
        }
      }
    }
  }

  return Array.from(visibleSet);
}

/**
 * Get the admin context for a Clerk user.
 * Wrapped in React cache() for per-request deduplication.
 */
export const getAdminContext = cache(async (clerkUserId: string): Promise<AdminContext | null> => {
  const member = await getMemberByClerkId(clerkUserId);
  if (!member) return null;

  const supabase = createServerClient();

  // Fetch admin-level roles, excluding expired ones
  const { data: roleData, error: roleError } = await supabase
    .from('rlc_member_roles')
    .select('id, role, charter_id, granted_by, granted_at, expires_at')
    .eq('contact_id', member.id)
    .in('role', ADMIN_ROLES)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

  if (roleError) {
    throw new Error(`Failed to fetch admin roles: ${roleError.message}`);
  }

  const roles = (roleData || []) as AdminRole[];
  if (roles.length === 0) return null;

  const highestRole = getHighestRole(roles);
  const isNational = getRoleWeight(highestRole) >= getRoleWeight('national_board');

  // National admins see everything
  if (isNational) {
    return { member, roles, highestRole, visibleCharterIds: null, isNational: true };
  }

  // Scoped admins: fetch all charters and walk the tree
  const { data: allCharters, error: charterError } = await supabase
    .from('rlc_charters')
    .select('id, parent_charter_id');

  if (charterError) {
    throw new Error(`Failed to fetch charters: ${charterError.message}`);
  }

  const charters = (allCharters || []) as Pick<Charter, 'id' | 'parent_charter_id'>[];
  const visibleCharterIds = buildVisibleCharterIds(roles, charters);

  // If no visible charters (all assigned charters deleted), deny access
  if (visibleCharterIds.length === 0) return null;

  return { member, roles, highestRole, visibleCharterIds, isNational: false };
});
