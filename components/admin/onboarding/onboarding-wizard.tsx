'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { OnboardingProgress } from './onboarding-progress';
import { CoordinatorMembershipStep } from './steps/coordinator-membership-step';
import { CoordinatorAppointmentStep } from './steps/coordinator-appointment-step';
import { RecruitMembersStep } from './steps/recruit-members-step';
import { TemplateBylawsStep } from './steps/template-bylaws-step';
import { OrganizationalMeetingStep } from './steps/organizational-meeting-step';
import { SubmitDocumentsStep } from './steps/submit-documents-step';
import { LegalEntityStep } from './steps/legal-entity-step';
import { StripeConnectStep } from './steps/stripe-connect-step';
import { STEP_ORDER } from '@/lib/onboarding/constants';
import { getNextStep } from '@/lib/onboarding/engine';
import type { OnboardingStep, OnboardingStepStatus, ChapterOnboarding, ChapterOnboardingStep } from '@/types';

interface OnboardingWizardProps {
  chapterId: string;
  chapterName: string;
  onboarding: (ChapterOnboarding & {
    coordinator: { id: string; first_name: string; last_name: string; email: string };
    steps: ChapterOnboardingStep[];
  }) | null;
  activeStep?: string;
  isNational: boolean;
  currentMemberId: string;
}

export function OnboardingWizard({
  chapterId,
  chapterName,
  onboarding,
  activeStep,
  isNational,
  currentMemberId,
}: OnboardingWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const steps = onboarding?.steps || [];
  const stepsState = steps.map((s) => ({ step: s.step as OnboardingStep, status: s.status as OnboardingStepStatus }));

  const currentStep = (activeStep && STEP_ORDER.includes(activeStep as OnboardingStep))
    ? activeStep as OnboardingStep
    : getNextStep(stepsState) || STEP_ORDER[0];

  const currentStepData = steps.find((s) => s.step === currentStep);
  const stepData = (currentStepData?.data || {}) as Record<string, unknown>;
  const stepStatus = (currentStepData?.status || 'not_started') as OnboardingStepStatus;

  const handleAction = useCallback(async (action: string, data?: Record<string, unknown>, reviewNotes?: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapterId}/onboarding/steps/${currentStep}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data, reviewNotes }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error);
      }

      const actionLabels: Record<string, string> = {
        save_draft: 'Draft saved',
        complete: 'Step completed',
        approve: 'Step approved',
        reject: 'Changes requested',
      };
      toast({ title: actionLabels[action] || 'Updated' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Operation failed',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [chapterId, currentStep, router, toast]);

  const handleSaveDraft = useCallback((data: Record<string, unknown>) => handleAction('save_draft', data), [handleAction]);
  const handleComplete = useCallback((data: Record<string, unknown>) => handleAction('complete', data), [handleAction]);
  const handleApprove = useCallback(() => handleAction('approve'), [handleAction]);
  const handleReject = useCallback(() => {
    const notes = window.prompt('What changes are needed?');
    if (notes) handleAction('reject', undefined, notes);
  }, [handleAction]);

  // If no onboarding exists, show creation prompt
  if (!onboarding) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Start Chapter Onboarding</h2>
        <p className="text-muted-foreground mb-6">
          Begin the 8-step onboarding process for {chapterName}.
        </p>
        {isNational ? (
          <Button
            onClick={async () => {
              setCreating(true);
              try {
                const res = await fetch(`/api/v1/admin/chapters/${chapterId}/onboarding`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ coordinatorId: currentMemberId }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: 'Failed' }));
                  throw new Error(err.error);
                }
                toast({ title: 'Onboarding started' });
                router.refresh();
              } catch (error) {
                toast({
                  title: 'Error',
                  description: error instanceof Error ? error.message : 'Failed to start onboarding',
                  variant: 'destructive',
                });
              } finally {
                setCreating(false);
              }
            }}
            disabled={creating}
            className="bg-rlc-red hover:bg-rlc-red/90"
          >
            {creating ? 'Starting...' : 'Start Onboarding'}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Only national admins can start onboarding.</p>
        )}
      </div>
    );
  }

  const coordinator = onboarding.coordinator;

  function renderStep() {
    const commonProps = {
      data: stepData,
      status: stepStatus,
      isNational,
      saving,
    };

    switch (currentStep) {
      case 'coordinator_membership':
        return (
          <CoordinatorMembershipStep
            {...commonProps}
            coordinator={coordinator}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
          />
        );
      case 'coordinator_appointment':
        return (
          <CoordinatorAppointmentStep
            {...commonProps}
            coordinator={coordinator}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );
      case 'recruit_members':
        return (
          <RecruitMembersStep
            {...commonProps}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
          />
        );
      case 'template_bylaws':
        return (
          <TemplateBylawsStep
            {...commonProps}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );
      case 'organizational_meeting':
        return (
          <OrganizationalMeetingStep
            {...commonProps}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
          />
        );
      case 'submit_documents':
        return (
          <SubmitDocumentsStep
            {...commonProps}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );
      case 'legal_entity':
        return (
          <LegalEntityStep
            {...commonProps}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
          />
        );
      case 'stripe_connect':
        return (
          <StripeConnectStep
            {...commonProps}
            chapterId={chapterId}
            onSaveDraft={handleSaveDraft}
            onComplete={handleComplete}
          />
        );
      default:
        return <p className="text-muted-foreground">Unknown step</p>;
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-4">
      {/* Left Sidebar */}
      <div className="lg:col-span-1">
        <div className="sticky top-4 rounded-lg border bg-card p-4">
          <OnboardingProgress
            chapterId={chapterId}
            chapterName={chapterName}
            steps={stepsState}
            activeStep={currentStep}
          />
        </div>
      </div>

      {/* Right Content */}
      <div className="lg:col-span-3">
        <div className="rounded-lg border bg-card p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
