'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { isValidSectionTransition } from '@/lib/vetting/engine';
import { VETTING_SECTION_STATUSES } from '@/lib/validations/vetting';
import { SECTIONS_WITH_AI_HELPER } from '@/lib/ai/vetting/types';
import type { VettingSectionStatus, VettingReportSectionType } from '@/types';
import type { ReportSectionWithAssignments, VettingPermissions, CommitteeMemberOption } from '../types';

interface SectionEditFormProps {
  vettingId: string;
  section: ReportSectionWithAssignments;
  permissions: VettingPermissions;
  committeeMembers: CommitteeMemberOption[];
  onClose: () => void;
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function renderDraftValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">None</span>;
  }

  if (typeof value === 'boolean') {
    return <span>{value ? 'Yes' : 'No'}</span>;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">None</span>;
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <ul className="list-disc list-inside space-y-0.5">
          {value.map((item, i) => (
            <li key={i} className="text-sm">{String(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="rounded border bg-muted/20 p-2 text-sm">
            {renderDraftValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground italic">Empty</span>;
    return (
      <div className={depth > 0 ? 'space-y-1' : 'space-y-2'}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="text-xs font-medium text-muted-foreground">{formatKey(k)}:</span>{' '}
            {typeof v === 'object' && v !== null ? (
              <div className="ml-3 mt-1">{renderDraftValue(v, depth + 1)}</div>
            ) : (
              renderDraftValue(v, depth + 1)
            )}
          </div>
        ))}
      </div>
    );
  }

  return <span>{JSON.stringify(value)}</span>;
}

export function SectionEditForm({
  vettingId,
  section,
  permissions,
  committeeMembers,
  onClose,
}: SectionEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showDraftPreview, setShowDraftPreview] = useState(!!section.ai_draft_data);
  const [dataStr, setDataStr] = useState(
    section.data ? JSON.stringify(section.data, null, 2) : ''
  );
  const [notes, setNotes] = useState(section.notes ?? '');
  const [status, setStatus] = useState(section.status);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const assignedMemberIds = section.assignments.map((a) => a.committee_member_id);
  const canEdit =
    permissions.canEditAnySection ||
    (permissions.committeeMemberId && assignedMemberIds.includes(permissions.committeeMemberId));

  const hasAiHelper = SECTIONS_WITH_AI_HELPER.includes(section.section as VettingReportSectionType);
  const hasExistingDraft = !!section.ai_draft_data;
  const hasReviewedData = !!section.data && Object.keys(section.data).length > 0;

  const validNextStatuses = VETTING_SECTION_STATUSES.filter(
    (s) => s === section.status || isValidSectionTransition(section.status, s)
  );

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    try {
      let parsedData: Record<string, unknown> | undefined;
      if (dataStr.trim()) {
        try {
          parsedData = JSON.parse(dataStr);
        } catch {
          alert('Invalid JSON in data field');
          return;
        }
      }

      const body: Record<string, unknown> = {};
      if (parsedData !== undefined) body.data = parsedData;
      if (notes !== (section.notes ?? '')) body.notes = notes || null;
      if (status !== section.status) body.status = status;

      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      const res = await fetch(
        `/api/v1/admin/vetting/${vettingId}/sections/${section.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to save section');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!selectedMemberId || !permissions.canAssignSections) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `/api/v1/admin/vetting/${vettingId}/sections/${section.id}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ committeeMemberId: selectedMemberId }),
        }
      );

      if (res.ok) {
        router.refresh();
        setSelectedMemberId('');
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to assign member');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(committeeMemberId: string) {
    if (!permissions.canAssignSections) return;
    if (!confirm('Remove this assignment?')) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `/api/v1/admin/vetting/${vettingId}/sections/${section.id}/assign`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ committeeMemberId }),
        }
      );
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to remove assignment');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleGenerateDraft() {
    if (!canEdit || !hasAiHelper) return;

    if (hasExistingDraft && !confirm('An AI draft already exists. Regenerate it?')) {
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(
        `/api/v1/admin/vetting/${vettingId}/sections/${section.id}/ai-draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: hasExistingDraft }),
        }
      );

      if (res.ok) {
        router.refresh();
        setShowDraftPreview(true);
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to generate AI draft');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAcceptDraft(mergeStrategy: 'replace' | 'merge') {
    if (!canEdit) return;
    setAccepting(true);
    try {
      const res = await fetch(
        `/api/v1/admin/vetting/${vettingId}/sections/${section.id}/accept-draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mergeStrategy }),
        }
      );

      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to accept AI draft');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setAccepting(false);
    }
  }

  const unassignedMembers = committeeMembers.filter(
    (m) => !assignedMemberIds.includes(m.id)
  );

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      {/* Assignments */}
      <div>
        <h4 className="text-sm font-medium mb-2">Assigned Members</h4>
        {section.assignments.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {section.assignments.map((a) => (
              <Badge key={a.id} variant="outline" className="gap-1">
                {a.committee_member?.contact
                  ? `${a.committee_member.contact.first_name} ${a.committee_member.contact.last_name}`
                  : a.committee_member_id}
                {permissions.canAssignSections && (
                  <button
                    onClick={() => handleUnassign(a.committee_member_id)}
                    disabled={assigning}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label="Remove assignment"
                  >
                    &times;
                  </button>
                )}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-2">No members assigned</p>
        )}

        {permissions.canAssignSections && unassignedMembers.length > 0 && (
          <div className="flex gap-2 items-center">
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className={ADMIN_INPUT_CLASS + ' max-w-xs'}
            >
              <option value="">Select member...</option>
              {unassignedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.contact
                    ? `${m.contact.first_name} ${m.contact.last_name}`
                    : m.contact_id}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAssign}
              disabled={!selectedMemberId || assigning}
            >
              Assign
            </Button>
          </div>
        )}
      </div>

      {/* AI Draft Controls */}
      {canEdit && hasAiHelper && (
        <div className="space-y-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <svg className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              AI Research Assistant
            </h4>
            <Button
              size="sm"
              variant={hasExistingDraft ? 'outline' : 'default'}
              onClick={handleGenerateDraft}
              disabled={generating}
              className={hasExistingDraft ? '' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {generating
                ? 'Generating...'
                : hasExistingDraft
                  ? 'Regenerate Draft'
                  : 'Generate AI Draft'}
            </Button>
          </div>

          {/* AI Draft Preview */}
          {hasExistingDraft && showDraftPreview && (
            <div className="space-y-3">
              <div className="rounded-md border bg-white p-3 text-sm dark:bg-gray-900">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                    AI-generated — review required
                  </Badge>
                  <button
                    onClick={() => setShowDraftPreview(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
                {renderDraftValue(section.ai_draft_data)}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleAcceptDraft('replace')}
                  disabled={accepting}
                >
                  {accepting ? 'Accepting...' : 'Accept Draft'}
                </Button>
                {hasReviewedData && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcceptDraft('merge')}
                    disabled={accepting}
                  >
                    Merge into Current
                  </Button>
                )}
              </div>
            </div>
          )}

          {hasExistingDraft && !showDraftPreview && (
            <button
              onClick={() => setShowDraftPreview(true)}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Show AI draft preview
            </button>
          )}
        </div>
      )}

      {/* Section data */}
      {canEdit && (
        <>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VettingSectionStatus)}
              className={ADMIN_INPUT_CLASS}
            >
              {validNextStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={ADMIN_LABEL_CLASS}>Data (JSON)</label>
            <textarea
              value={dataStr}
              onChange={(e) => setDataStr(e.target.value)}
              rows={8}
              className={ADMIN_INPUT_CLASS + ' font-mono text-xs'}
              placeholder='{"key": "value"}'
            />
          </div>

          <div>
            <label className={ADMIN_LABEL_CLASS}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={ADMIN_INPUT_CLASS}
              placeholder="Section notes..."
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-rlc-red hover:bg-rlc-red/90"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </>
      )}

      {!canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
