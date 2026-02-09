import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/admin/permissions';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const ctx = await getAdminContext(userId);

  if (!ctx) {
    redirect('/dashboard?error=unauthorized');
  }

  return <AdminShell>{children}</AdminShell>;
}
