'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { isValidSectionTransition } from '@/lib/vetting/engine';
import { VETTING_SECTION_STATUSES } from '@/lib/validations/vetting';
import type { VettingSectionStatus } from '@/types';
import type { ReportSectionWithAssignments, VettingPermissions, CommitteeMemberOption } from '../types';

interface SectionEditFormProps {
  vettingId: string;
  section: ReportSectionWithAssignments;
  permissions: VettingPermissions;
  committeeMembers: CommitteeMemberOption[];
  onClose: () => void;
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
        const err = await res.json();
        alert(err.error || 'Failed to save section');
      }
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
        const err = await res.json();
        alert(err.error || 'Failed to assign member');
      }
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
        const err = await res.json();
        alert(err.error || 'Failed to remove assignment');
      }
    } finally {
      setAssigning(false);
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
