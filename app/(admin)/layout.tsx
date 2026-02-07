import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/navigation/admin-nav';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';

async function checkAdminAccess(clerkUserId: string): Promise<boolean> {
  const member = await getMemberByClerkId(clerkUserId);
  if (!member) return false;

  // Check if user has admin role
  const supabase = createServerClient();
  const { data: roles } = await supabase
    .from('rlc_member_roles')
    .select('role')
    .eq('member_id', member.id)
    .in('role', ['chapter_admin', 'state_chair', 'national_board', 'super_admin']);

  return (roles && roles.length > 0) || false;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const hasAccess = await checkAdminAccess(userId);

  if (!hasAccess) {
    redirect('/dashboard?error=unauthorized');
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 bg-muted/30">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
