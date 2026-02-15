import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, type AdminContext } from '@/lib/admin/permissions';

type ServerClient = ReturnType<typeof createServerClient>;

/**
 * Require admin auth for server components (pages/layouts).
 * Redirects to sign-in or dashboard on failure.
 */
export async function requireAdmin(): Promise<{ ctx: AdminContext; supabase: ServerClient }> {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  let ctx: AdminContext | null;
  try {
    ctx = await getAdminContext(userId);
  } catch {
    redirect('/dashboard?error=server-error');
  }
  if (!ctx) redirect('/dashboard?error=unauthorized');

  return { ctx, supabase: createServerClient() };
}

/**
 * Require admin auth for API routes.
 * Returns { ctx, supabase } on success, or a NextResponse error on failure.
 */
export async function requireAdminApi(): Promise<
  | { ctx: AdminContext; supabase: ServerClient; error?: never }
  | { error: NextResponse; ctx?: never; supabase?: never }
> {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let ctx: AdminContext | null;
  try {
    ctx = await getAdminContext(userId);
  } catch {
    return { error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
  }
  if (!ctx) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ctx, supabase: createServerClient() };
}
