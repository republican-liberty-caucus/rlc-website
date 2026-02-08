import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { PostEditorForm } from '@/components/admin/post-editor-form';

export const metadata: Metadata = {
  title: 'Create Post - Admin',
};

export default async function AdminCreatePostPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  let chapterQuery = supabase
    .from('rlc_chapters')
    .select('id, name')
    .eq('status', 'active')
    .order('name');

  if (ctx.visibleChapterIds !== null && ctx.visibleChapterIds.length > 0) {
    chapterQuery = chapterQuery.in('id', ctx.visibleChapterIds);
  }

  const { data: chapters } = await chapterQuery;

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/posts" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Posts
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Create Post</h1>
      </div>

      <PostEditorForm
        post={null}
        chapters={(chapters || []) as { id: string; name: string }[]}
      />
    </div>
  );
}
