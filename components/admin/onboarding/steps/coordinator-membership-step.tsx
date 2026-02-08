'use client';

import { StepActions } from './step-actions';
import type { OnboardingStepStatus } from '@/types';

interface CoordinatorMembershipStepProps {
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  coordinator: { id: string; first_name: string; last_name: string; email: string } | null;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
}

export function CoordinatorMembershipStep({
  data,
  status,
  isNational,
  coordinator,
  saving,
  onSaveDraft,
  onComplete,
}: CoordinatorMembershipStepProps) {
  const verified = !!coordinator;
  const stepData = {
    member_id: coordinator?.id || '',
    verified,
    tier: (data.tier as string) || 'individual',
    status: (data.status as string) || 'current',
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Coordinator Membership Verification</h3>
        <p className="text-sm text-muted-foreground">
          The coordinator must be a dues-paying RLC member in good standing.
        </p>
      </div>

      {coordinator ? (
        <div className="rounded-md border bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-800">
            {coordinator.first_name} {coordinator.last_name}
          </p>
          <p className="text-green-700">{coordinator.email}</p>
          <p className="mt-1 text-green-600">Membership verified</p>
        </div>
      ) : (
        <div className="rounded-md border bg-yellow-50 p-4 text-sm">
          <p className="text-yellow-800">No coordinator assigned. A national admin must assign one first.</p>
        </div>
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
