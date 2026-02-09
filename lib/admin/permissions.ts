import { cache } from 'react';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { VALID_MEMBERSHIP_STATUSES, VALID_MEMBERSHIP_TIERS } from '@/lib/validations/admin';
import type { Contact, UserRole, Chapter } from '@/types';

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
  chapter_id: string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
}

export interface AdminContext {
  member: Contact;
  roles: AdminRole[];
  highestRole: UserRole;
  /** null = national admin, sees everything; string[] = scoped chapter IDs */
  visibleChapterIds: string[] | null;
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

/** Returns true if the admin can view a member with the given primary_chapter_id */
export function canViewMember(ctx: AdminContext, primaryChapterId: string | null): boolean {
  if (ctx.visibleChapterIds === null) return true;
  if (!primaryChapterId) return false;
  return ctx.visibleChapterIds.includes(primaryChapterId);
}

interface MemberFilterParams {
  search?: string | null;
  status?: string | null;
  tier?: string | null;
}

/** Apply standard member list filters (chapter scoping, search, status, tier) to a Supabase query builder. */
export function applyMemberFilters<T extends { in: (col: string, vals: string[]) => T; or: (filter: string) => T; eq: (col: string, val: string) => T }>(
  query: T,
  visibleChapterIds: string[] | null,
  filters: MemberFilterParams
): T {
  if (visibleChapterIds !== null && visibleChapterIds.length > 0) {
    query = query.in('primary_chapter_id', visibleChapterIds);
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
 * Build the set of chapter IDs visible to a scoped admin.
 * Walks the chapter tree downward from each role's chapter_id,
 * collecting all descendant chapter IDs.
 */
function buildVisibleChapterIds(
  roles: AdminRole[],
  chapters: Pick<Chapter, 'id' | 'parent_chapter_id'>[]
): string[] {
  const chapterIdSet = new Set(chapters.map((ch) => ch.id));

  // Build parent→children map
  const childrenMap = new Map<string, string[]>();
  for (const ch of chapters) {
    if (ch.parent_chapter_id) {
      const siblings = childrenMap.get(ch.parent_chapter_id) || [];
      siblings.push(ch.id);
      childrenMap.set(ch.parent_chapter_id, siblings);
    }
  }

  // Collect all descendant IDs from each role's chapter_id
  const visibleSet = new Set<string>();
  for (const role of roles) {
    if (!role.chapter_id) continue;
    // Skip roles referencing deleted chapters
    if (!chapterIdSet.has(role.chapter_id)) continue;
    const stack = [role.chapter_id];
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
    .select('id, role, chapter_id, granted_by, granted_at, expires_at')
    .eq('member_id', member.id)
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
    return { member, roles, highestRole, visibleChapterIds: null, isNational: true };
  }

  // Scoped admins: fetch all chapters and walk the tree
  const { data: allChapters, error: chapterError } = await supabase
    .from('rlc_chapters')
    .select('id, parent_chapter_id');

  if (chapterError) {
    throw new Error(`Failed to fetch chapters: ${chapterError.message}`);
  }

  const chapters = (allChapters || []) as Pick<Chapter, 'id' | 'parent_chapter_id'>[];
  const visibleChapterIds = buildVisibleChapterIds(roles, chapters);

  // If no visible chapters (all assigned chapters deleted), deny access
  if (visibleChapterIds.length === 0) return null;

  return { member, roles, highestRole, visibleChapterIds, isNational: false };
});
