'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import type { Chapter, ChapterStatus } from '@/types';

interface ChapterDetailFormProps {
  chapter: Chapter;
}

const STATUS_OPTIONS: { value: ChapterStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'forming', label: 'Forming' },
];

export function ChapterDetailForm({ chapter }: ChapterDetailFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);

    const body = {
      name: formData.get('name') as string,
      contactEmail: (formData.get('contactEmail') as string) || null,
      websiteUrl: (formData.get('websiteUrl') as string) || null,
      status: formData.get('status') as string,
    };

    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errorMessage = 'Failed to update chapter';
        try {
          const err = await res.json();
          errorMessage = err.error || errorMessage;
        } catch {
          // Response was not JSON (e.g., 502 gateway error)
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Chapter updated',
        description: `${body.name} has been updated.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update chapter',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-lg border bg-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Chapter Details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Chapter Name</label>
            <input name="name" defaultValue={chapter.name} required className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Contact Email</label>
            <input name="contactEmail" type="email" defaultValue={chapter.contact_email || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Website URL</label>
            <input name="websiteUrl" type="url" defaultValue={chapter.website_url || ''} className={ADMIN_INPUT_CLASS} />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Status</label>
            <select name="status" defaultValue={chapter.status} className={ADMIN_INPUT_CLASS}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Level</label>
            <input value={chapter.chapter_level.replace(/_/g, ' ')} disabled className={`${ADMIN_INPUT_CLASS} capitalize opacity-60`} />
          </div>
          {chapter.state_code && (
            <div>
              <label className={ADMIN_LABEL_CLASS}>State</label>
              <input value={chapter.state_code} disabled className={`${ADMIN_INPUT_CLASS} opacity-60`} />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="bg-rlc-red hover:bg-rlc-red/90">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
