import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { PostEditorForm } from '@/components/admin/post-editor-form';
import type { Post } from '@/types';

interface PageDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from('rlc_posts').select('title').eq('id', id).single();
  const post = data as { title: string } | null;
  return { title: post ? `${post.title} - Admin` : 'Page - Admin' };
}

export default async function AdminPageDetailPage({ params }: PageDetailPageProps) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;
  const supabase = createServerClient();

  const { data: postData, error: postError } = await supabase
    .from('rlc_posts').select('*').eq('id', id).eq('content_type', 'page').single();

  if (postError || !postData) notFound();

  const post = postData as Post;

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/pages" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Pages
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{post.title}</h1>
      </div>

      <PostEditorForm
        post={post}
        charters={[]}
        contentType="page"
      />
    </div>
  );
}
