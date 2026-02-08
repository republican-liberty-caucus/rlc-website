import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { PostEditorForm } from '@/components/admin/post-editor-form';

interface PostDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from('rlc_posts').select('title').eq('id', id).single();
  const post = data as { title: string } | null;
  return { title: post ? `${post.title} - Admin` : 'Post - Admin' };
}

export default async function AdminPostDetailPage({ params }: PostDetailPageProps) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;
  const supabase = createServerClient();

  const { data: postData, error: postError } = await supabase
    .from('rlc_posts').select('*').eq('id', id).single();

  if (postError || !postData) notFound();

  const post = postData as {
    id: string;
    title: string;
    slug: string;
    content: string | null;
    excerpt: string | null;
    featured_image_url: string | null;
    chapter_id: string | null;
    status: string;
    published_at: string | null;
    categories: string[];
    tags: string[];
    seo_title: string | null;
    seo_description: string | null;
  };

  // Check chapter visibility
  if (post.chapter_id && ctx.visibleChapterIds !== null) {
    if (!ctx.visibleChapterIds.includes(post.chapter_id)) {
      redirect('/admin/posts?error=forbidden');
    }
  }

  let chaptersQuery = supabase.from('rlc_chapters').select('id, name').eq('status', 'active').order('name');
  if (ctx.visibleChapterIds !== null && ctx.visibleChapterIds.length > 0) {
    chaptersQuery = chaptersQuery.in('id', ctx.visibleChapterIds);
  }
  const { data: chapters } = await chaptersQuery;

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/posts" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Posts
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{post.title}</h1>
      </div>

      <PostEditorForm
        post={post}
        chapters={(chapters || []) as { id: string; name: string }[]}
      />
    </div>
  );
}
