'use client';

import { useState } from 'react';
import { ADMIN_INPUT_CLASS } from '@/components/admin/form-styles';
import { Button } from '@/components/ui/button';
import { StepActions } from './step-actions';
import { isStepEditable } from '@/lib/onboarding/engine';
import { Plus, Trash2 } from 'lucide-react';
import type { OnboardingStepStatus } from '@/types';

interface FoundingMember {
  member_id?: string;
  name: string;
  email: string;
  status: 'linked' | 'invited' | 'pending';
}

interface RecruitMembersStepProps {
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
}

export function RecruitMembersStep({
  data,
  status,
  isNational,
  saving,
  onSaveDraft,
  onComplete,
}: RecruitMembersStepProps) {
  const [members, setMembers] = useState<FoundingMember[]>(
    (data.founding_members as FoundingMember[]) || []
  );

  const isEditable = isStepEditable(status);

  function addMember() {
    setMembers([...members, { name: '', email: '', status: 'pending' }]);
  }

  function removeMember(idx: number) {
    setMembers(members.filter((_, i) => i !== idx));
  }

  function updateMember(idx: number, field: keyof FoundingMember, value: string) {
    const updated = [...members];
    updated[idx] = { ...updated[idx], [field]: value };
    setMembers(updated);
  }

  const stepData = { founding_members: members };
  const meetsMinimum = members.length >= 10;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Recruit 10 Founding Members</h3>
        <p className="text-sm text-muted-foreground">
          Identify and link at least 10 founding members for the new charter.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${meetsMinimum ? 'text-green-600' : 'text-yellow-600'}`}>
          {members.length} of 10 members
        </span>
        {isEditable && (
          <Button type="button" variant="outline" size="sm" onClick={addMember}>
            <Plus className="mr-1 h-3 w-3" />
            Add Member
          </Button>
        )}
      </div>

      {members.length > 0 && (
        <div className="space-y-3">
          {members.map((m, idx) => (
            <div key={idx} className="flex items-start gap-2 rounded border bg-muted/30 p-3">
              <div className="flex-1 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Name</label>
                  <input
                    value={m.name}
                    onChange={(e) => updateMember(idx, 'name', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    disabled={!isEditable}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={m.email}
                    onChange={(e) => updateMember(idx, 'email', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    disabled={!isEditable}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              {isEditable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(idx)}
                  className="h-8 w-8 p-0 mt-5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!meetsMinimum && isEditable && (
        <p className="text-sm text-yellow-600">Need at least {10 - members.length} more members to complete this step.</p>
      )}

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
