'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';

interface Post {
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
}

interface PostEditorFormProps {
  post: Post | null;
  chapters: { id: string; name: string }[];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function PostEditorForm({ post, chapters }: PostEditorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!post);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData(e.currentTarget);

    const categoriesStr = (fd.get('categories') as string) || '';
    const tagsStr = (fd.get('tags') as string) || '';

    const body: Record<string, unknown> = {
      title: fd.get('title') as string,
      slug: fd.get('slug') as string,
      content: (fd.get('content') as string) || null,
      excerpt: (fd.get('excerpt') as string) || null,
      featuredImageUrl: (fd.get('featuredImageUrl') as string) || null,
      chapterId: (fd.get('chapterId') as string) || null,
      status: fd.get('status') as string,
      categories: categoriesStr ? categoriesStr.split(',').map((s) => s.trim()).filter(Boolean) : [],
      tags: tagsStr ? tagsStr.split(',').map((s) => s.trim()).filter(Boolean) : [],
      seoTitle: (fd.get('seoTitle') as string) || null,
      seoDescription: (fd.get('seoDescription') as string) || null,
    };

    const isCreate = !post;
    const url = isCreate ? '/api/v1/admin/posts' : `/api/v1/admin/posts/${post.id}`;
    const method = isCreate ? 'POST' : 'PATCH';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Failed to ${isCreate ? 'create' : 'update'} post`;
        try {
          const err = await res.json();
          msg = err.error || msg;
        } catch {
          // non-JSON response
        }
        throw new Error(msg);
      }

      const data = await res.json();
      toast({
        title: isCreate ? 'Post created' : 'Post updated',
        description: `"${body.title}" has been ${isCreate ? 'created' : 'updated'}.`,
      });

      if (isCreate && data.post?.id) {
        router.push(`/admin/posts/${data.post.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Basic Info */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Post Details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Title</label>
            <input
              name="title"
              defaultValue={post?.title || ''}
              required
              className={ADMIN_INPUT_CLASS}
              onChange={(e) => {
                if (autoSlug) {
                  const slugEl = e.currentTarget.form?.elements.namedItem('slug') as HTMLInputElement;
                  if (slugEl) slugEl.value = slugify(e.target.value);
                }
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Slug</label>
            <input
              name="slug"
              defaultValue={post?.slug || ''}
              required
              className={ADMIN_INPUT_CLASS}
              onFocus={() => setAutoSlug(false)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Excerpt</label>
            <textarea
              name="excerpt"
              defaultValue={post?.excerpt || ''}
              rows={2}
              className={ADMIN_INPUT_CLASS}
              placeholder="Brief summary for listings..."
            />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Content (HTML)</label>
            <textarea
              name="content"
              defaultValue={post?.content || ''}
              rows={16}
              className={`${ADMIN_INPUT_CLASS} font-mono text-sm`}
            />
          </div>
        </div>
      </div>

      {/* Publishing */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Publishing</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL_CLASS}>Status</label>
            <select name="status" defaultValue={post?.status || 'draft'} className={ADMIN_INPUT_CLASS}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Chapter</label>
            <select name="chapterId" defaultValue={post?.chapter_id || ''} className={ADMIN_INPUT_CLASS}>
              <option value="">National (no chapter)</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Featured Image URL</label>
            <input name="featuredImageUrl" type="url" defaultValue={post?.featured_image_url || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Categories (comma-separated)</label>
            <input name="categories" defaultValue={post?.categories.join(', ') || ''} className={ADMIN_INPUT_CLASS} placeholder="news, policy, events" />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Tags (comma-separated)</label>
            <input name="tags" defaultValue={post?.tags.join(', ') || ''} className={ADMIN_INPUT_CLASS} placeholder="liberty, second-amendment" />
          </div>
        </div>
      </div>

      {/* SEO */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">SEO</h2>
        <div className="grid gap-4">
          <div>
            <label className={ADMIN_LABEL_CLASS}>SEO Title</label>
            <input name="seoTitle" defaultValue={post?.seo_title || ''} className={ADMIN_INPUT_CLASS} placeholder="Custom title for search engines" />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>SEO Description</label>
            <textarea name="seoDescription" defaultValue={post?.seo_description || ''} rows={2} className={ADMIN_INPUT_CLASS} placeholder="Custom description for search engines" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-rlc-red hover:bg-rlc-red/90">
          {saving ? 'Saving...' : post ? 'Save Changes' : 'Create Post'}
        </Button>
      </div>
    </form>
  );
}
