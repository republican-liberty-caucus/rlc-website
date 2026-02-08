'use client';

import { Button } from '@/components/ui/button';
import { isStepEditable } from '@/lib/onboarding/engine';
import type { OnboardingStepStatus } from '@/types';

interface StepActionsProps {
  status: OnboardingStepStatus;
  requiresReview: boolean;
  isNational: boolean;
  saving: boolean;
  canComplete?: boolean;
  onSaveDraft: () => void;
  onComplete: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

export function StepActions({
  status,
  requiresReview,
  isNational,
  saving,
  canComplete: canCompleteProp,
  onSaveDraft,
  onComplete,
  onApprove,
  onReject,
}: StepActionsProps) {
  const isEditable = isStepEditable(status);
  const statusAllowsComplete = status === 'not_started' || status === 'in_progress';
  const canComplete = statusAllowsComplete && (canCompleteProp ?? true);
  const canReview = isNational && status === 'completed' && requiresReview;
  const isDone = status === 'approved' || (status === 'completed' && !requiresReview);

  if (isDone) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <span className="font-medium">Step completed</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isEditable && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          {canComplete && (
            <Button
              type="button"
              size="sm"
              onClick={onComplete}
              disabled={saving}
              className="bg-rlc-red hover:bg-rlc-red/90"
            >
              {saving ? 'Completing...' : 'Complete Step'}
            </Button>
          )}
        </>
      )}

      {canReview && (
        <>
          <Button
            type="button"
            size="sm"
            onClick={onApprove}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReject}
            disabled={saving}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Request Changes
          </Button>
        </>
      )}

      {status === 'completed' && requiresReview && !isNational && (
        <span className="text-sm text-yellow-600">Awaiting national review</span>
      )}

      {status === 'rejected' && (
        <span className="text-sm text-red-600">Changes requested — edit and resubmit</span>
      )}
    </div>
  );
}
