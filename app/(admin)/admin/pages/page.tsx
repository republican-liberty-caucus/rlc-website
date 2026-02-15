import { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pages - Admin',
  description: 'Manage RLC static pages',
};

interface PageRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}

async function getPages(): Promise<PageRow[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_posts')
    .select('id, title, slug, status, created_at, updated_at')
    .eq('content_type', 'page')
    .order('title', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch pages: ${error.message}`);
  }

  return (data || []) as PageRow[];
}

export default async function AdminPagesPage() {
  await requireAdmin();

  const pages = await getPages();

  return (
    <div>
      <PageHeader
        title="Pages"
        count={pages.length}
        className="mb-8"
        action={
          <Link href="/admin/pages/new">
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Page
            </Button>
          </Link>
        }
      />

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Slug</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Last Updated</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{page.title}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">/{page.slug}</td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={page.status} type="post" />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(page.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/pages/${page.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {pages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No pages yet. Create your first page to get started.
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
