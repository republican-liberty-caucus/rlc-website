'use client';

import { useState } from 'react';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { StepActions } from './step-actions';
import { isStepEditable } from '@/lib/onboarding/engine';
import type { OnboardingStepStatus } from '@/types';

interface TemplateBylawsStepProps {
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function TemplateBylawsStep({
  data,
  status,
  isNational,
  saving,
  onSaveDraft,
  onComplete,
  onApprove,
  onReject,
}: TemplateBylawsStepProps) {
  const [reviewed, setReviewed] = useState((data.reviewed as boolean) || false);
  const [deviations, setDeviations] = useState((data.deviations as string) || '');
  const [bylawsUrl, setBylawsUrl] = useState((data.bylaws_url as string) || '');

  const isEditable = isStepEditable(status);
  const stepData = { reviewed, deviations, bylaws_url: bylawsUrl || undefined };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Template Bylaws</h3>
        <p className="text-sm text-muted-foreground">
          Review the RLC template bylaws, note any deviations, and upload the customized version.
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-4">
        <p className="text-sm font-medium mb-2">Template Bylaws</p>
        <p className="text-xs text-muted-foreground mb-3">
          Download the template, review all sections, and customize for your charter.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
            disabled={!isEditable}
            className="rounded"
          />
          I have reviewed the template bylaws
        </label>
      </div>

      <div>
        <label className={ADMIN_LABEL_CLASS}>Deviations from Template (if any)</label>
        <textarea
          value={deviations}
          onChange={(e) => setDeviations(e.target.value)}
          className={`${ADMIN_INPUT_CLASS} h-24 resize-none`}
          disabled={!isEditable}
          placeholder="Describe any changes made to the template..."
        />
      </div>

      <div>
        <label className={ADMIN_LABEL_CLASS}>Bylaws Document URL (optional)</label>
        <input
          type="url"
          value={bylawsUrl}
          onChange={(e) => setBylawsUrl(e.target.value)}
          className={ADMIN_INPUT_CLASS}
          disabled={!isEditable}
          placeholder="https://..."
        />
      </div>

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
