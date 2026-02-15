'use client';

import { useState } from 'react';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { Button } from '@/components/ui/button';
import { StepActions } from './step-actions';
import { isStepEditable } from '@/lib/onboarding/engine';
import { OFFICER_TITLE_LABELS } from '@/lib/validations/officer-position';
import { Plus, Trash2 } from 'lucide-react';
import type { OnboardingStepStatus, OfficerTitle } from '@/types';

interface Officer {
  member_id?: string;
  name: string;
  title: string;
}

const MEETING_OFFICER_TITLES: OfficerTitle[] = [
  'chair',
  'vice_chair',
  'secretary',
  'treasurer',
  'at_large_board',
];

interface OrganizationalMeetingStepProps {
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
}

export function OrganizationalMeetingStep({
  data,
  status,
  isNational,
  saving,
  onSaveDraft,
  onComplete,
}: OrganizationalMeetingStepProps) {
  const [meetingDate, setMeetingDate] = useState((data.meeting_date as string) || '');
  const [bylawsAdopted, setBylawsAdopted] = useState((data.bylaws_adopted as boolean) || false);
  const [officers, setOfficers] = useState<Officer[]>(
    (data.officers as Officer[]) || [
      { name: '', title: 'chair' },
      { name: '', title: 'vice_chair' },
      { name: '', title: 'secretary' },
      { name: '', title: 'treasurer' },
    ]
  );

  const isEditable = isStepEditable(status);

  function addOfficer() {
    setOfficers([...officers, { name: '', title: 'at_large_board' }]);
  }

  function removeOfficer(idx: number) {
    if (officers.length <= 4) return;
    setOfficers(officers.filter((_, i) => i !== idx));
  }

  function updateOfficer(idx: number, field: keyof Officer, value: string) {
    const updated = [...officers];
    updated[idx] = { ...updated[idx], [field]: value };
    setOfficers(updated);
  }

  const stepData = { meeting_date: meetingDate, bylaws_adopted: bylawsAdopted, officers };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Organizational Meeting</h3>
        <p className="text-sm text-muted-foreground">
          Hold the first meeting, elect at least 4 officers, and adopt the bylaws.
        </p>
      </div>

      <div>
        <label className={ADMIN_LABEL_CLASS}>Meeting Date</label>
        <input
          type="date"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          className={ADMIN_INPUT_CLASS}
          disabled={!isEditable}
        />
      </div>

      <div className="rounded-md border bg-muted/30 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={bylawsAdopted}
            onChange={(e) => setBylawsAdopted(e.target.checked)}
            disabled={!isEditable}
            className="rounded"
          />
          Bylaws were formally adopted at this meeting
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={ADMIN_LABEL_CLASS}>Elected Officers (min 4)</label>
          {isEditable && (
            <Button type="button" variant="outline" size="sm" onClick={addOfficer}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {officers.map((o, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded border bg-muted/30 p-3">
              <div className="flex-1 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Name</label>
                  <input
                    value={o.name}
                    onChange={(e) => updateOfficer(idx, 'name', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    disabled={!isEditable}
                    placeholder="Officer name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Title</label>
                  <select
                    value={o.title}
                    onChange={(e) => updateOfficer(idx, 'title', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    disabled={!isEditable}
                  >
                    {MEETING_OFFICER_TITLES.map((title) => (
                      <option key={title} value={title}>{OFFICER_TITLE_LABELS[title]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {isEditable && officers.length > 4 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOfficer(idx)}
                  className="h-8 w-8 p-0 mt-5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <StepActions
        status={status}
        requiresReview={false}
        isNational={isNational}
        saving={saving}
        onSaveDraft={() => onSaveDraft(stepData)}
        onComplete={() => onComplete(stepData)}
      />
    </div>
  );
}
