import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Press Releases - Admin',
  description: 'Manage RLC press releases',
};

interface PressReleaseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  created_at: string;
  author: { first_name: string; last_name: string } | null;
}

async function getPressReleases(visibleCharterIds: string[] | null): Promise<PressReleaseRow[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('rlc_posts')
    .select(`
      id, title, slug, status, published_at, created_at,
      author:rlc_members(first_name, last_name)
    `)
    .eq('content_type', 'press_release')
    .order('created_at', { ascending: false });

  if (visibleCharterIds !== null && visibleCharterIds.length > 0) {
    query = query.in('charter_id', visibleCharterIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch press releases: ${error.message}`);
  }

  return (data || []) as PressReleaseRow[];
}

export default async function AdminPressReleasesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const pressReleases = await getPressReleases(ctx.visibleCharterIds);

  return (
    <div>
      <PageHeader
        title="Press Releases"
        count={pressReleases.length}
        className="mb-8"
        action={
          <Link href="/admin/posts/new?contentType=press_release">
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Press Release
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
                <th className="px-4 py-3 text-left text-sm font-medium">Author</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pressReleases.map((pr) => (
                <tr key={pr.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{pr.title}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {pr.author ? `${pr.author.first_name} ${pr.author.last_name}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={pr.status} type="post" />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {pr.published_at ? formatDate(pr.published_at) : formatDate(pr.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/posts/${pr.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {pressReleases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No press releases yet. Press releases are auto-created when a board vote is finalized.
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
