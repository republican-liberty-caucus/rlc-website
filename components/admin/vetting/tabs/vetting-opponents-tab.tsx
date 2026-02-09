'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { OpponentData, VettingPermissions } from '../types';

interface OpponentFormData {
  name: string;
  party: string;
  isIncumbent: boolean;
  background: string;
  credibility: string;
  endorsements: string;
  photoUrl: string;
}

const emptyForm: OpponentFormData = {
  name: '',
  party: '',
  isIncumbent: false,
  background: '',
  credibility: '',
  endorsements: '',
  photoUrl: '',
};

function opponentToForm(o: OpponentData): OpponentFormData {
  return {
    name: o.name,
    party: o.party ?? '',
    isIncumbent: o.is_incumbent,
    background: o.background ?? '',
    credibility: o.credibility ?? '',
    endorsements: o.endorsements.join(', '),
    photoUrl: o.photo_url ?? '',
  };
}

interface VettingOpponentsTabProps {
  vettingId: string;
  opponents: OpponentData[];
  permissions: VettingPermissions;
}

export function VettingOpponentsTab({ vettingId, opponents, permissions }: VettingOpponentsTabProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OpponentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canMutate = permissions.isCommitteeMember || permissions.isNational;
  const canDelete = permissions.isChair || permissions.isNational;

  function formToPayload(f: OpponentFormData) {
    return {
      name: f.name,
      party: f.party || null,
      isIncumbent: f.isIncumbent,
      background: f.background || null,
      credibility: f.credibility || null,
      endorsements: f.endorsements
        ? f.endorsements.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      photoUrl: f.photoUrl || null,
    };
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      alert('Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vettingId}/opponents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      });
      if (res.ok) {
        router.refresh();
        setForm(emptyForm);
        setShowAdd(false);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to create opponent');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(opponentId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vettingId}/opponents/${opponentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      });
      if (res.ok) {
        router.refresh();
        setEditingId(null);
        setForm(emptyForm);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to update opponent');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(opponentId: string) {
    if (!confirm('Delete this opponent? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vettingId}/opponents/${opponentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to delete opponent');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    }
  }

  function renderForm(onSubmit: () => void, submitLabel: string) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL_CLASS}>Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={ADMIN_INPUT_CLASS}
              placeholder="Opponent name"
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Party</label>
            <input
              value={form.party}
              onChange={(e) => setForm({ ...form, party: e.target.value })}
              className={ADMIN_INPUT_CLASS}
              placeholder="e.g. Democrat"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isIncumbent"
            checked={form.isIncumbent}
            onChange={(e) => setForm({ ...form, isIncumbent: e.target.checked })}
          />
          <label htmlFor="isIncumbent" className="text-sm">Incumbent</label>
        </div>

        <div>
          <label className={ADMIN_LABEL_CLASS}>Background</label>
          <textarea
            value={form.background}
            onChange={(e) => setForm({ ...form, background: e.target.value })}
            rows={3}
            className={ADMIN_INPUT_CLASS}
            placeholder="Professional/political background..."
          />
        </div>

        <div>
          <label className={ADMIN_LABEL_CLASS}>Credibility</label>
          <textarea
            value={form.credibility}
            onChange={(e) => setForm({ ...form, credibility: e.target.value })}
            rows={2}
            className={ADMIN_INPUT_CLASS}
            placeholder="Credibility assessment..."
          />
        </div>

        <div>
          <label className={ADMIN_LABEL_CLASS}>Endorsements (comma-separated)</label>
          <input
            value={form.endorsements}
            onChange={(e) => setForm({ ...form, endorsements: e.target.value })}
            className={ADMIN_INPUT_CLASS}
            placeholder="NRA, Chamber of Commerce, ..."
          />
        </div>

        <div>
          <label className={ADMIN_LABEL_CLASS}>Photo URL</label>
          <input
            value={form.photoUrl}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            className={ADMIN_INPUT_CLASS}
            placeholder="https://..."
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowAdd(false);
              setEditingId(null);
              setForm(emptyForm);
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-rlc-red hover:bg-rlc-red/90"
            onClick={onSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {canMutate && !showAdd && !editingId && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setShowAdd(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Opponent
          </Button>
        </div>
      )}

      {showAdd && renderForm(handleCreate, 'Add Opponent')}

      {opponents.map((opp) => (
        <div key={opp.id} className="rounded-lg border bg-card p-4">
          {editingId === opp.id ? (
            renderForm(() => handleUpdate(opp.id), 'Save Changes')
          ) : (
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{opp.name}</h4>
                    {opp.party && (
                      <Badge variant="outline" className="text-xs">
                        {opp.party}
                      </Badge>
                    )}
                    {opp.is_incumbent && (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-transparent">
                        Incumbent
                      </Badge>
                    )}
                  </div>
                  {opp.background && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {opp.background}
                    </p>
                  )}
                  {opp.endorsements.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Endorsements: {opp.endorsements.join(', ')}
                    </p>
                  )}
                </div>
                {canMutate && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setForm(opponentToForm(opp));
                        setEditingId(opp.id);
                        setShowAdd(false);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(opp.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {opponents.length === 0 && !showAdd && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No opponents tracked for this vetting yet.
        </div>
      )}
    </div>
  );
}
