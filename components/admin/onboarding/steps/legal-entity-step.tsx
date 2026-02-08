'use client';

import { useState } from 'react';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { StepActions } from './step-actions';
import { isStepEditable } from '@/lib/onboarding/engine';
import type { OnboardingStepStatus } from '@/types';

interface LegalEntityStepProps {
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
}

export function LegalEntityStep({
  data,
  status,
  isNational,
  saving,
  onSaveDraft,
  onComplete,
}: LegalEntityStepProps) {
  const [ein, setEin] = useState((data.ein as string) || '');
  const [bankName, setBankName] = useState((data.bank_name as string) || '');
  const [signatory1, setSignatory1] = useState((data.signatory_1 as string) || '');
  const [signatory2, setSignatory2] = useState((data.signatory_2 as string) || '');
  const [stateRegistration, setStateRegistration] = useState((data.state_registration as string) || '');

  const isEditable = isStepEditable(status);

  const stepData = {
    ein: ein || undefined,
    bank_name: bankName || undefined,
    signatory_1: signatory1 || undefined,
    signatory_2: signatory2 || undefined,
    state_registration: stateRegistration || undefined,
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Legal Entity & Banking</h3>
        <p className="text-sm text-muted-foreground">
          File for an EIN, open a bank account, and complete state registration.
        </p>
      </div>

      <div>
        <label className={ADMIN_LABEL_CLASS}>EIN (Employer Identification Number)</label>
        <input
          value={ein}
          onChange={(e) => setEin(e.target.value)}
          className={ADMIN_INPUT_CLASS}
          disabled={!isEditable}
          placeholder="XX-XXXXXXX"
        />
        <p className="mt-1 text-xs text-muted-foreground">Apply at irs.gov/ein</p>
      </div>

      <div>
        <label className={ADMIN_LABEL_CLASS}>Bank Name</label>
        <input
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className={ADMIN_INPUT_CLASS}
          disabled={!isEditable}
          placeholder="Bank or credit union name"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ADMIN_LABEL_CLASS}>Signatory 1</label>
          <input
            value={signatory1}
            onChange={(e) => setSignatory1(e.target.value)}
            className={ADMIN_INPUT_CLASS}
            disabled={!isEditable}
            placeholder="Name of first signatory"
          />
        </div>
        <div>
          <label className={ADMIN_LABEL_CLASS}>Signatory 2</label>
          <input
            value={signatory2}
            onChange={(e) => setSignatory2(e.target.value)}
            className={ADMIN_INPUT_CLASS}
            disabled={!isEditable}
            placeholder="Name of second signatory"
          />
        </div>
      </div>

      <div>
        <label className={ADMIN_LABEL_CLASS}>State Registration / Filing</label>
        <input
          value={stateRegistration}
          onChange={(e) => setStateRegistration(e.target.value)}
          className={ADMIN_INPUT_CLASS}
          disabled={!isEditable}
          placeholder="State registration number or status"
        />
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
