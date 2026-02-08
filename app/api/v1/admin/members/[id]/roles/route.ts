import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, canManageRoles, getHighestRole, getRoleWeight } from '@/lib/admin/permissions';
import { roleAssignmentSchema } from '@/lib/validations/admin';
import type { AdminRole } from '@/lib/admin/permissions';
import { logger } from '@/lib/logger';

interface MemberRef {
  id: string;
  clerk_user_id: string | null;
}

async function fetchMemberRef(
  supabase: ReturnType<typeof createServerClient>,
  memberId: string
): Promise<MemberRef | null> {
  const { data, error } = await supabase
    .from('rlc_members')
    .select('id, clerk_user_id')
    .eq('id', memberId)
    .single();

  if (error || !data) return null;
  return data as MemberRef;
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
      .from('rlc_member_roles')
      .select('id, role, chapter_id, granted_by, granted_at, expires_at')
      .eq('member_id', memberId);

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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx || !canManageRoles(ctx)) {
    return NextResponse.json({ error: 'Forbidden: national_board+ required' }, { status: 403 });
  }

  const { id: memberId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parseResult = roleAssignmentSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { role, chapterId } = parseResult.data;

  // Prevent assigning roles equal to or above the caller's own level
  if (getRoleWeight(role) >= getRoleWeight(ctx.highestRole)) {
    return NextResponse.json(
      { error: 'Cannot assign a role at or above your own level' },
      { status: 403 }
    );
  }

  const supabase = createServerClient();

  const member = await fetchMemberRef(supabase, memberId);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Insert role
  const { data: roleData, error: insertError } = await supabase
    .from('rlc_member_roles')
    .insert({
      member_id: memberId,
      role,
      chapter_id: chapterId,
      granted_by: ctx.member.id,
    } as never)
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'This role is already assigned' }, { status: 409 });
    }
    logger.error('Error assigning role:', insertError);
    return NextResponse.json({ error: 'Failed to assign role' }, { status: 500 });
  }

  const syncWarning = await trySyncRoleToClerk(supabase, memberId, member.clerk_user_id);
  const warnings = syncWarning ? [syncWarning] : [];

  return NextResponse.json({ role: roleData, warnings }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx || !canManageRoles(ctx)) {
    return NextResponse.json({ error: 'Forbidden: national_board+ required' }, { status: 403 });
  }

  const { id: memberId } = await params;
  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get('roleId');

  if (!roleId) {
    return NextResponse.json({ error: 'roleId query parameter required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const member = await fetchMemberRef(supabase, memberId);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Verify the role belongs to this member
  const { data: roleRow, error: roleError } = await supabase
    .from('rlc_member_roles')
    .select('id, member_id')
    .eq('id', roleId)
    .eq('member_id', memberId)
    .single();

  if (roleError || !roleRow) {
    return NextResponse.json({ error: 'Role not found' }, { status: 404 });
  }

  // Delete the role
  const { error: deleteError } = await supabase
    .from('rlc_member_roles')
    .delete()
    .eq('id', roleId);

  if (deleteError) {
    logger.error('Error revoking role:', deleteError);
    return NextResponse.json({ error: 'Failed to revoke role' }, { status: 500 });
  }

  const syncWarning = await trySyncRoleToClerk(supabase, memberId, member.clerk_user_id);
  const warnings = syncWarning ? [syncWarning] : [];

  return NextResponse.json({ success: true, warnings });
}
