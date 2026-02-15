import { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { PostEditorForm } from '@/components/admin/post-editor-form';
import { wpautop, promoteHeadings } from '@/lib/wordpress/content';
import type { Post } from '@/types';

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
  const { ctx, supabase } = await requireAdmin();

  const { id } = await params;

  const { data: postData, error: postError } = await supabase
    .from('rlc_posts').select('*').eq('id', id).single();

  if (postError || !postData) notFound();

  const post = postData as Post;

  // Pre-process legacy WordPress content so the editor gets structured HTML
  if (post.content && !/<(?:p|h[1-6]|div|ul|ol|blockquote)[\s>]/i.test(post.content)) {
    post.content = wpautop(promoteHeadings(post.content));
  }

  // Check charter visibility
  if (post.charter_id && ctx.visibleCharterIds !== null) {
    if (!ctx.visibleCharterIds.includes(post.charter_id)) {
      redirect('/admin/posts?error=forbidden');
    }
  }

  let chartersQuery = supabase.from('rlc_charters').select('id, name').eq('status', 'active').order('name');
  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    chartersQuery = chartersQuery.in('id', ctx.visibleCharterIds);
  }
  const { data: charters } = await chartersQuery;

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
        charters={(charters || []) as { id: string; name: string }[]}
      />
    </div>
  );
}
