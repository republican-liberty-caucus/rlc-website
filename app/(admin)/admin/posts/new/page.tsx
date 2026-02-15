import { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { PostEditorForm } from '@/components/admin/post-editor-form';

export const metadata: Metadata = {
  title: 'Create Post - Admin',
};

interface AdminCreatePostPageProps {
  searchParams: Promise<{ contentType?: string }>;
}

export default async function AdminCreatePostPage({ searchParams }: AdminCreatePostPageProps) {
  const { ctx, supabase } = await requireAdmin();

  const params = await searchParams;
  const contentType = params.contentType === 'press_release' ? 'press_release'
    : params.contentType === 'page' ? 'page' : 'post';

  const entityLabel = contentType === 'page' ? 'Page'
    : contentType === 'press_release' ? 'Press Release' : 'Post';
  const backPath = contentType === 'page' ? '/admin/pages'
    : contentType === 'press_release' ? '/admin/press-releases' : '/admin/posts';

  let charterQuery = supabase
    .from('rlc_charters')
    .select('id, name')
    .eq('status', 'active')
    .order('name');

  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    charterQuery = charterQuery.in('id', ctx.visibleCharterIds);
  }

  const { data: charters } = await charterQuery;

  return (
    <div>
      <div className="mb-8">
        <Link href={backPath} className="text-sm text-muted-foreground hover:underline">
          &larr; Back to {entityLabel}s
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Create {entityLabel}</h1>
      </div>

      <PostEditorForm
        post={null}
        charters={(charters || []) as { id: string; name: string }[]}
        contentType={contentType}
      />
    </div>
  );
}
