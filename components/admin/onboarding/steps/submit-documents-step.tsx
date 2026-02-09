'use client';

import { useState } from 'react';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { StepActions } from './step-actions';
import { isStepEditable } from '@/lib/onboarding/engine';
import type { OnboardingStepStatus } from '@/types';

const CHARTER_QUESTIONS = [
  'Why is your community interested in forming an RLC charter?',
  'What liberty-focused issues are most important in your area?',
  'How do you plan to recruit and retain members?',
  'What outreach activities do you plan to conduct?',
  'How will your charter engage with local Republican Party organizations?',
];

const ACKNOWLEDGMENTS = [
  'We agree to uphold the RLC Statement of Principles.',
  'We agree to maintain a minimum of 10 active members.',
  'We agree to hold at least one meeting per quarter.',
  'We agree to participate in RLC national communications and campaigns.',
  'We agree to submit annual reports to RLC National.',
  'We accept the terms of the RLC Charter Memorandum of Understanding.',
];

interface SubmitDocumentsStepProps {
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function SubmitDocumentsStep({
  data,
  status,
  isNational,
  saving,
  onSaveDraft,
  onComplete,
  onApprove,
  onReject,
}: SubmitDocumentsStepProps) {
  const questions = (data.questions || {}) as Record<string, string>;
  const acks = (data.acknowledgments || {}) as Record<string, boolean>;

  const [charterName, setCharterName] = useState((data.charter_name as string) || '');
  const [stateCode, setStateCode] = useState((data.state_code as string) || '');
  const [formationDate, setFormationDate] = useState((data.formation_date as string) || '');
  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: questions.q1 || '',
    q2: questions.q2 || '',
    q3: questions.q3 || '',
    q4: questions.q4 || '',
    q5: questions.q5 || '',
  });
  const [acknowledgments, setAcknowledgments] = useState<Record<string, boolean>>({
    a1: acks.a1 || false,
    a2: acks.a2 || false,
    a3: acks.a3 || false,
    a4: acks.a4 || false,
    a5: acks.a5 || false,
    a6: acks.a6 || false,
  });
  const [mouAccepted, setMouAccepted] = useState((data.mou_accepted as boolean) || false);

  const isEditable = isStepEditable(status);

  const stepData = {
    charter_name: charterName,
    state_code: stateCode || undefined,
    formation_date: formationDate || undefined,
    questions: answers,
    acknowledgments,
    mou_accepted: mouAccepted,
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Submit Charter Documents</h3>
        <p className="text-sm text-muted-foreground">
          Complete the charter application, answer required questions, and accept the MOU.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={ADMIN_LABEL_CLASS}>Charter Name</label>
          <input
            value={charterName}
            onChange={(e) => setCharterName(e.target.value)}
            className={ADMIN_INPUT_CLASS}
            disabled={!isEditable}
          />
        </div>
        <div>
          <label className={ADMIN_LABEL_CLASS}>State Code</label>
          <input
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value.toUpperCase())}
            maxLength={2}
            className={ADMIN_INPUT_CLASS}
            disabled={!isEditable}
            placeholder="TX"
          />
        </div>
      </div>

      <div>
        <label className={ADMIN_LABEL_CLASS}>Formation Date</label>
        <input
          type="date"
          value={formationDate}
          onChange={(e) => setFormationDate(e.target.value)}
          className={ADMIN_INPUT_CLASS}
          disabled={!isEditable}
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Charter Application Questions</h4>
        {CHARTER_QUESTIONS.map((q, idx) => {
          const key = `q${idx + 1}`;
          return (
            <div key={key}>
              <label className={ADMIN_LABEL_CLASS}>{idx + 1}. {q}</label>
              <textarea
                value={answers[key] || ''}
                onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })}
                className={`${ADMIN_INPUT_CLASS} h-20 resize-none`}
                disabled={!isEditable}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Acknowledgments</h4>
        {ACKNOWLEDGMENTS.map((text, idx) => {
          const key = `a${idx + 1}`;
          return (
            <label key={key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledgments[key] || false}
                onChange={(e) => setAcknowledgments({ ...acknowledgments, [key]: e.target.checked })}
                disabled={!isEditable}
                className="mt-0.5 rounded"
              />
              {text}
            </label>
          );
        })}
      </div>

      <div className="rounded-md border bg-muted/30 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={mouAccepted}
            onChange={(e) => setMouAccepted(e.target.checked)}
            disabled={!isEditable}
            className="rounded"
          />
          I accept the RLC Charter Memorandum of Understanding
        </label>
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
