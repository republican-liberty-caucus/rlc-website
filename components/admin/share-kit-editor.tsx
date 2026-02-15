'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import type { ShareKit, SocialCopyVariants } from '@/types';

interface ShareKitEditorProps {
  kit: ShareKit;
}

const PLATFORMS = ['x', 'facebook', 'linkedin'] as const;
const TONES = ['formal', 'casual', 'punchy'] as const;

const PLATFORM_LABELS: Record<string, string> = {
  x: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

const TONE_LABELS: Record<string, string> = {
  formal: 'Formal',
  casual: 'Casual',
  punchy: 'Punchy',
};

export function ShareKitEditor({ kit }: ShareKitEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(kit.title);
  const [description, setDescription] = useState(kit.description || '');
  const [ogImageOverrideUrl, setOgImageOverrideUrl] = useState(kit.og_image_override_url || '');
  const [status, setStatus] = useState(kit.status);
  const [socialCopy, setSocialCopy] = useState<SocialCopyVariants>(kit.social_copy);

  const handleCopyChange = useCallback(
    (platform: string, tone: string, value: string) => {
      setSocialCopy((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform as keyof SocialCopyVariants],
          [tone]: value,
        },
      }));
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const body: Record<string, unknown> = {
      title,
      description: description || null,
      socialCopy: socialCopy,
      ogImageOverrideUrl: ogImageOverrideUrl || null,
      status,
    };

    try {
      const res = await fetch(`/api/v1/admin/share-kits/${kit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update share kit');
      }

      toast({
        title: 'Share kit updated',
        description: `"${title}" has been updated.`,
      });
      router.refresh();
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
      <div className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Basic Information</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className={ADMIN_LABEL_CLASS}>
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={ADMIN_INPUT_CLASS}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className={ADMIN_LABEL_CLASS}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={ADMIN_INPUT_CLASS}
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="status" className={ADMIN_LABEL_CLASS}>
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ShareKit['status'])}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* OG Image Override */}
      <div className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Social Preview Image</h2>
        <div>
          <label htmlFor="ogImageOverrideUrl" className={ADMIN_LABEL_CLASS}>
            OG Image Override URL
          </label>
          <input
            id="ogImageOverrideUrl"
            type="url"
            value={ogImageOverrideUrl}
            onChange={(e) => setOgImageOverrideUrl(e.target.value)}
            className={ADMIN_INPUT_CLASS}
            placeholder="Leave empty to use auto-generated image"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Override the auto-generated social preview image with a custom URL.
          </p>
        </div>
        {(ogImageOverrideUrl || kit.og_image_url) && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ogImageOverrideUrl || kit.og_image_url || ''}
              alt="OG image preview"
              className="max-h-48 rounded border object-contain"
            />
          </div>
        )}
      </div>

      {/* Social Copy */}
      <div className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Social Copy</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Pre-written copy for members to share. Each platform has three tone variants.
        </p>

        <div className="space-y-6">
          {PLATFORMS.map((platform) => (
            <div key={platform}>
              <h3 className="mb-3 text-sm font-semibold">
                {PLATFORM_LABELS[platform]}
              </h3>
              <div className="space-y-3">
                {TONES.map((tone) => (
                  <div key={`${platform}-${tone}`}>
                    <label
                      htmlFor={`copy-${platform}-${tone}`}
                      className={ADMIN_LABEL_CLASS}
                    >
                      {TONE_LABELS[tone]}
                    </label>
                    <textarea
                      id={`copy-${platform}-${tone}`}
                      value={socialCopy[platform]?.[tone] || ''}
                      onChange={(e) =>
                        handleCopyChange(platform, tone, e.target.value)
                      }
                      className={ADMIN_INPUT_CLASS}
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} className="bg-rlc-red hover:bg-rlc-red/90">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/share-kits')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
