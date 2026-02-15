import { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { PostEditorForm } from '@/components/admin/post-editor-form';

export const metadata: Metadata = {
  title: 'Create Page - Admin',
};

export default async function AdminCreatePagePage() {
  await requireAdmin();

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
