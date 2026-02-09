'use client';

import { useState } from 'react';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { StepActions } from './step-actions';
import { isStepEditable } from '@/lib/onboarding/engine';
import type { OnboardingStepStatus } from '@/types';

interface CoordinatorAppointmentStepProps {
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  coordinator: { id: string; first_name: string; last_name: string; email: string } | null;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function CoordinatorAppointmentStep({
  data,
  status,
  isNational,
  coordinator,
  saving,
  onSaveDraft,
  onComplete,
  onApprove,
  onReject,
}: CoordinatorAppointmentStepProps) {
  const [roleType, setRoleType] = useState((data.role_type as string) || 'coordinator');

  const isEditable = isStepEditable(status);

  const stepData = {
    appointed_by: (data.appointed_by as string) || '',
    appointment_date: (data.appointment_date as string) || new Date().toISOString().split('T')[0],
    role_type: roleType,
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Coordinator Appointment</h3>
        <p className="text-sm text-muted-foreground">
          A national admin assigns the coordinator for this forming charter.
        </p>
      </div>

      {coordinator && (
        <div className="rounded-md border p-4 text-sm">
          <p className="font-medium">{coordinator.first_name} {coordinator.last_name}</p>
          <p className="text-muted-foreground">{coordinator.email}</p>
        </div>
      )}

      <div>
        <label className={ADMIN_LABEL_CLASS}>Role Type</label>
        <select
          value={roleType}
          onChange={(e) => setRoleType(e.target.value)}
          className={ADMIN_INPUT_CLASS}
          disabled={!isEditable}
        >
          <option value="contact">Contact (initial outreach)</option>
          <option value="coordinator">Coordinator (full authority)</option>
        </select>
      </div>

      {status === 'rejected' && Boolean(data.review_notes) && (
        <div className="rounded-md border bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Changes requested:</p>
          <p>{String(data.review_notes)}</p>
        </div>
      )}

      <StepActions
        status={status}
        requiresReview={true}
        isNational={isNational}
        saving={saving}
        onSaveDraft={() => onSaveDraft(stepData)}
        onComplete={() => onComplete(stepData)}
        onApprove={onApprove}
        onReject={onReject}
      />
    </div>
  );
}
