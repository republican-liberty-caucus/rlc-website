import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { canManageRoles, getHighestRole, getRoleWeight } from '@/lib/admin/permissions';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { roleAssignmentSchema } from '@/lib/validations/admin';
import type { AdminRole } from '@/lib/admin/permissions';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

interface ContactRef {
  id: string;
  clerk_user_id: string | null;
}

async function fetchMemberRef(
  supabase: ReturnType<typeof createServerClient>,
  memberId: string
): Promise<ContactRef | null> {
  const { data, error } = await supabase
    .from('rlc_contacts')
    .select('id, clerk_user_id')
    .eq('id', memberId)
    .single();

  if (error || !data) return null;
  return data as ContactRef;
}

/** Recalculate the member's highest role and sync to Clerk publicMetadata (non-fatal). Returns warning if sync fails. */
async function trySyncRoleToClerk(
  supabase: ReturnType<typeof createServerClient>,
  memberId: string,
  clerkUserId: string | null
): Promise<string | null> {
  if (!clerkUserId) return null;
  try {
    const { data: roles } = await supabase
      .from('rlc_contact_roles')
      .select('id, role, charter_id, granted_by, granted_at, expires_at')
      .eq('contact_id', memberId);

    const highest = getHighestRole((roles || []) as AdminRole[]);
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { role: highest },
    });
    return null;
  } catch (clerkError) {
    logger.error('Failed to sync role to Clerk:', clerkError);
    return 'Role saved but Clerk sync failed. User may need to log out and back in.';
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!canManageRoles(ctx)) {
    return apiError('Forbidden: national_board+ required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: memberId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON in request body', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = roleAssignmentSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const { role, charterId } = parseResult.data;

  // Prevent assigning roles equal to or above the caller's own level
  if (getRoleWeight(role) >= getRoleWeight(ctx.highestRole)) {
    return apiError('Cannot assign a role at or above your own level', ApiErrorCode.FORBIDDEN, 403);
  }

  const member = await fetchMemberRef(supabase, memberId);
  if (!member) {
    return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
  }

  // Insert role
  const { data: roleData, error: insertError } = await supabase
    .from('rlc_contact_roles')
    .insert({
      contact_id: memberId,
      role,
      charter_id: charterId,
      granted_by: ctx.member.id,
    } as never)
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return apiError('This role is already assigned', ApiErrorCode.CONFLICT, 409);
    }
    logger.error('Error assigning role:', insertError);
    return apiError('Failed to assign role', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const syncWarning = await trySyncRoleToClerk(supabase, memberId, member.clerk_user_id);
  const warnings = syncWarning ? [syncWarning] : [];

  return NextResponse.json({ role: roleData, warnings }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  if (!canManageRoles(ctx)) {
    return apiError('Forbidden: national_board+ required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: memberId } = await params;
  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get('roleId');

  if (!roleId) {
    return apiError('roleId query parameter required', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const member = await fetchMemberRef(supabase, memberId);
  if (!member) {
    return apiError('Member not found', ApiErrorCode.NOT_FOUND, 404);
  }

  // Verify the role belongs to this member
  const { data: roleRow, error: roleError } = await supabase
    .from('rlc_contact_roles')
    .select('id, contact_id')
    .eq('id', roleId)
    .eq('contact_id', memberId)
    .single();

  if (roleError || !roleRow) {
    return apiError('Role not found', ApiErrorCode.NOT_FOUND, 404);
  }

  // Delete the role
  const { error: deleteError } = await supabase
    .from('rlc_contact_roles')
    .delete()
    .eq('id', roleId);

  if (deleteError) {
    logger.error('Error revoking role:', deleteError);
    return apiError('Failed to revoke role', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const syncWarning = await trySyncRoleToClerk(supabase, memberId, member.clerk_user_id);
  const warnings = syncWarning ? [syncWarning] : [];

  return NextResponse.json({ success: true, warnings });
}
