import { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Share Kits - Admin',
  description: 'Manage member promotion share kits',
};

interface ShareKitRow {
  id: string;
  title: string;
  content_type: string;
  status: string;
  scope: string;
  created_at: string;
}

export default async function AdminShareKitsPage() {
  const { ctx, supabase } = await requireAdmin();

  let query = supabase
    .from('rlc_share_kits')
    .select('id, title, content_type, status, scope, created_at')
    .order('created_at', { ascending: false });

  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    query = query.or(`charter_id.in.(${ctx.visibleCharterIds.join(',')}),scope.eq.national`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch share kits: ${error.message}`);

  const shareKits = (data || []) as ShareKitRow[];

  return (
    <div>
      <PageHeader
        title="Share Kits"
        count={shareKits.length}
        className="mb-8"
      />

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Scope</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="hidden px-4 py-3 text-left text-sm font-medium md:table-cell">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shareKits.map((kit) => (
                <tr key={kit.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{kit.title}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                      {kit.content_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-xs capitalize text-muted-foreground">{kit.scope}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={kit.status} type="post" />
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                    {formatDate(kit.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/share-kits/${kit.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {shareKits.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No share kits yet. Share kits are auto-created when endorsements are finalized.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
