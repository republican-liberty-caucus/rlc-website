'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, X } from 'lucide-react';
import { ADMIN_INPUT_CLASS } from '@/components/admin/form-styles';
import { OFFICER_TITLE_LABELS, OFFICER_TITLES } from '@/lib/validations/officer-position';
import { formatDate } from '@/lib/utils';
import type { OfficerTitle } from '@/types';

interface OfficerRow {
  id: string;
  title: OfficerTitle;
  committee_name: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  notes: string | null;
  member: { id: string; first_name: string; last_name: string; email: string } | null;
  appointed_by: { first_name: string; last_name: string } | null;
}

interface ChapterOfficersCardProps {
  chapterId: string;
  officers: OfficerRow[];
  members: { id: string; first_name: string; last_name: string }[];
}

export function ChapterOfficersCard({ chapterId, officers, members }: ChapterOfficersCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);

  const activeOfficers = officers.filter((o) => o.is_active);
  const pastOfficers = officers.filter((o) => !o.is_active);

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      memberId: fd.get('memberId') as string,
      title: fd.get('title') as string,
      committeeName: (fd.get('committeeName') as string) || null,
      notes: (fd.get('notes') as string) || null,
    };

    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapterId}/officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to assign officer' }));
        throw new Error(err.error);
      }

      toast({ title: 'Officer assigned' });
      setShowForm(false);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign officer',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEndPosition(positionId: string) {
    setEndingId(positionId);
    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapterId}/officers/${positionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endedAt: new Date().toISOString(), isActive: false }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to end position' }));
        throw new Error(err.error);
      }

      toast({ title: 'Position ended' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to end position',
        variant: 'destructive',
      });
    } finally {
      setEndingId(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Officers</h2>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAssign} className="mb-4 space-y-3 rounded border bg-muted/30 p-3">
          <div>
            <label className="block text-xs font-medium mb-1">Member</label>
            <select name="memberId" required className={ADMIN_INPUT_CLASS}>
              <option value="">Select member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <select name="title" required className={ADMIN_INPUT_CLASS}>
              {OFFICER_TITLES.map((t) => (
                <option key={t} value={t}>{OFFICER_TITLE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Committee Name (if applicable)</label>
            <input name="committeeName" className={ADMIN_INPUT_CLASS} placeholder="e.g. Chartering Committee" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes (optional)</label>
            <input name="notes" className={ADMIN_INPUT_CLASS} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="bg-rlc-red hover:bg-rlc-red/90">
              {submitting ? 'Assigning...' : 'Assign'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {activeOfficers.length > 0 ? (
        <ul className="space-y-3">
          {activeOfficers.map((o) => (
            <li key={o.id} className="flex items-start justify-between border-b pb-2 last:border-0 last:pb-0">
              <div>
                <span className="text-sm font-medium">
                  {OFFICER_TITLE_LABELS[o.title]}
                  {o.committee_name && ` — ${o.committee_name}`}
                </span>
                <p className="text-xs text-muted-foreground">
                  {o.member ? `${o.member.first_name} ${o.member.last_name}` : 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Since {formatDate(o.started_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEndPosition(o.id)}
                disabled={endingId === o.id}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="End position"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No active officers</p>
      )}

      {pastOfficers.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">Past Officers</p>
          <ul className="space-y-1">
            {pastOfficers.slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {OFFICER_TITLE_LABELS[o.title]} — {o.member ? `${o.member.first_name} ${o.member.last_name}` : 'Unknown'}
                </span>
                <span>{o.ended_at ? formatDate(o.ended_at) : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
