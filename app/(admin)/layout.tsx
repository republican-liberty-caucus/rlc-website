import { requireAdmin } from '@/lib/admin/route-helpers';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
