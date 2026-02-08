import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/navigation/admin-nav';
import { getAdminContext } from '@/lib/admin/permissions';

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

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 bg-muted/30">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
