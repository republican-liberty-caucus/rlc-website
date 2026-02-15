'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ExternalLink, Upload } from 'lucide-react';
import type { Post } from '@/types';
import { uploadFile } from '@/lib/upload';

interface PostEditorFormProps {
  post: Post | null;
  charters: { id: string; name: string }[];
  contentType?: 'post' | 'page' | 'press_release';
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function PostEditorForm({ post, charters, contentType = 'post' }: PostEditorFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!post);
  const [content, setContent] = useState(post?.content || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const featuredImageRef = useRef<HTMLInputElement>(null);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleContentChange = useCallback((html: string) => {
    setContent(html);
    setIsDirty(true);
  }, []);

  const isPage = contentType === 'page';
  const isPressRelease = contentType === 'press_release';
  const entityLabel = isPage ? 'Page' : isPressRelease ? 'Press Release' : 'Post';

  async function handleFeaturedImageUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingImage(true);
      try {
        const url = await uploadFile(file);
        if (featuredImageRef.current) {
          featuredImageRef.current.value = url;
        }
        toast({ title: 'Image uploaded', description: 'Featured image URL has been set.' });
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Something went wrong',
          variant: 'destructive',
        });
      } finally {
        setUploadingImage(false);
      }
    };
    input.click();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData(e.currentTarget);

    const categoriesStr = (fd.get('categories') as string) || '';
    const tagsStr = (fd.get('tags') as string) || '';

    const body: Record<string, unknown> = {
      title: fd.get('title') as string,
      slug: fd.get('slug') as string,
      content: content || null,
      excerpt: (fd.get('excerpt') as string) || null,
      featuredImageUrl: (fd.get('featuredImageUrl') as string) || null,
      status: fd.get('status') as string,
      contentType,
      seoTitle: (fd.get('seoTitle') as string) || null,
      seoDescription: (fd.get('seoDescription') as string) || null,
    };

    if (!isPage) {
      body.charterId = (fd.get('charterId') as string) || null;
      body.categories = categoriesStr ? categoriesStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
      body.tags = tagsStr ? tagsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else {
      body.charterId = null;
      body.categories = [];
      body.tags = [];
    }

    if (isPressRelease && (!body.categories || (body.categories as string[]).length === 0)) {
      body.categories = ['press-release'];
    }

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
        const fallback = `Failed to ${isCreate ? 'create' : 'update'} ${entityLabel.toLowerCase()}`;
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || fallback);
      }

      const data = await res.json();
      setIsDirty(false);
      toast({
        title: isCreate ? `${entityLabel} created` : `${entityLabel} updated`,
        description: `"${body.title}" has been ${isCreate ? 'created' : 'updated'}.`,
      });

      const backPath = isPage ? '/admin/pages' : isPressRelease ? '/admin/press-releases' : '/admin/posts';
      if (isCreate && data.post?.id) {
        router.push(`${backPath}/${data.post.id}`);
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
    <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)}>
      {/* Basic Info */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {entityLabel} Details
          {isDirty && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500" title="Unsaved changes" />}
        </h2>
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
            <label className={ADMIN_LABEL_CLASS}>
              {isPage ? 'Description (optional, used for SEO)' : 'Excerpt'}
            </label>
            <textarea
              name="excerpt"
              defaultValue={post?.excerpt || ''}
              rows={2}
              className={ADMIN_INPUT_CLASS}
              placeholder={isPage ? 'Brief description for search engines...' : 'Brief summary for listings...'}
            />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Content</label>
            <RichTextEditor
              initialContent={post?.content || undefined}
              onChange={handleContentChange}
              onDirtyChange={setIsDirty}
              onError={(msg) => toast({ title: 'Editor error', description: msg, variant: 'destructive' })}
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
          {!isPage && (
            <div>
              <label className={ADMIN_LABEL_CLASS}>Charter</label>
              <select name="charterId" defaultValue={post?.charter_id || ''} className={ADMIN_INPUT_CLASS}>
                <option value="">National (no charter)</option>
                {charters.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={ADMIN_LABEL_CLASS}>Featured Image</label>
            <div className="flex gap-2">
              <input
                ref={featuredImageRef}
                name="featuredImageUrl"
                type="url"
                defaultValue={post?.featured_image_url || ''}
                className={ADMIN_INPUT_CLASS}
                placeholder="https://..."
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleFeaturedImageUpload}
                disabled={uploadingImage}
                title="Upload image"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!isPage && (
            <>
              <div>
                <label className={ADMIN_LABEL_CLASS}>Categories (comma-separated)</label>
                <input name="categories" defaultValue={post?.categories.join(', ') || ''} className={ADMIN_INPUT_CLASS} placeholder="news, policy, events" />
              </div>
              <div>
                <label className={ADMIN_LABEL_CLASS}>Tags (comma-separated)</label>
                <input name="tags" defaultValue={post?.tags.join(', ') || ''} className={ADMIN_INPUT_CLASS} placeholder="liberty, second-amendment" />
              </div>
            </>
          )}
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
        {post && (
          <Button type="button" variant="outline" asChild>
            <a
              href={isPage ? `/${post.slug}` : isPressRelease ? `/press-releases/${post.slug}` : `/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview
            </a>
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-rlc-red hover:bg-rlc-red/90">
          {saving ? 'Saving...' : post ? `Save Changes` : `Create ${entityLabel}`}
        </Button>
      </div>
    </form>
  );
}
