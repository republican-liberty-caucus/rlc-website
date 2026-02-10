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
  title: 'Posts - Admin',
  description: 'Manage RLC blog posts',
};

interface PostRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  created_at: string;
  author: { first_name: string; last_name: string } | null;
  charter: { name: string } | null;
}

async function getPosts(visibleCharterIds: string[] | null): Promise<PostRow[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('rlc_posts')
    .select(`
      id, title, slug, status, published_at, created_at,
      author:rlc_members(first_name, last_name),
      charter:rlc_charters(name)
    `)
    .eq('content_type', 'post')
    .order('created_at', { ascending: false });

  if (visibleCharterIds !== null && visibleCharterIds.length > 0) {
    query = query.in('charter_id', visibleCharterIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return (data || []) as PostRow[];
}

export default async function AdminPostsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const posts = await getPosts(ctx.visibleCharterIds);

  return (
    <div>
      <PageHeader
        title="Blog Posts"
        count={posts.length}
        className="mb-8"
        action={
          <Link href="/admin/posts/new">
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Post
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
                <th className="px-4 py-3 text-left text-sm font-medium">Charter</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{post.title}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {post.author ? `${post.author.first_name} ${post.author.last_name}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {post.charter?.name || 'National'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={post.status} type="post" />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {post.published_at ? formatDate(post.published_at) : formatDate(post.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/posts/${post.id}`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No posts yet. Create your first post to get started.
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
