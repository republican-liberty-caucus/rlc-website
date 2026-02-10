import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/admin/permissions';
import { PostEditorForm } from '@/components/admin/post-editor-form';

export const metadata: Metadata = {
  title: 'Create Page - Admin',
};

export default async function AdminCreatePagePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/pages" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Pages
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Create Page</h1>
      </div>

      <PostEditorForm
        post={null}
        charters={[]}
        contentType="page"
      />
    </div>
  );
}
