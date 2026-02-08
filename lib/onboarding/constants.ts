import type { OnboardingStep, OnboardingStepStatus } from '@/types';

export interface StepDefinition {
  step: OnboardingStep;
  label: string;
  description: string;
  requiresReview: boolean;
  dependencies: OnboardingStep[];
}

export const ONBOARDING_STEPS: StepDefinition[] = [
  {
    step: 'coordinator_membership',
    label: 'Coordinator Membership',
    description: 'Verify coordinator is a dues-paying RLC member.',
    requiresReview: false,
    dependencies: [],
  },
  {
    step: 'coordinator_appointment',
    label: 'Coordinator Appointment',
    description: 'National assigns coordinator for the forming chapter.',
    requiresReview: true,
    dependencies: ['coordinator_membership'],
  },
  {
    step: 'recruit_members',
    label: 'Recruit 10 Members',
    description: 'Identify and link at least 10 founding members.',
    requiresReview: false,
    dependencies: ['coordinator_appointment'],
  },
  {
    step: 'template_bylaws',
    label: 'Template Bylaws',
    description: 'Review template bylaws, note deviations, upload customized version.',
    requiresReview: true,
    dependencies: ['coordinator_appointment'],
  },
  {
    step: 'organizational_meeting',
    label: 'Organizational Meeting',
    description: 'Hold meeting, elect officers (min 4), adopt bylaws.',
    requiresReview: false,
    dependencies: ['recruit_members', 'template_bylaws'],
  },
  {
    step: 'submit_documents',
    label: 'Submit Documents',
    description: 'Complete charter application, answer questions, accept MOU.',
    requiresReview: true,
    dependencies: ['coordinator_membership', 'coordinator_appointment', 'recruit_members', 'template_bylaws', 'organizational_meeting'],
  },
  {
    step: 'legal_entity',
    label: 'Legal Entity & Banking',
    description: 'File EIN, open bank account, state registration.',
    requiresReview: false,
    dependencies: ['submit_documents'],
  },
  {
    step: 'stripe_connect',
    label: 'Stripe Connect',
    description: 'Connect Stripe account for dues processing.',
    requiresReview: false,
    dependencies: ['submit_documents'],
  },
];

export const STEP_ORDER: OnboardingStep[] = ONBOARDING_STEPS.map((s) => s.step);

export function getStepDefinition(step: OnboardingStep): StepDefinition | undefined {
  return ONBOARDING_STEPS.find((s) => s.step === step);
}

export function getStepIndex(step: OnboardingStep): number {
  return STEP_ORDER.indexOf(step);
}

export const DONE_STATUSES: OnboardingStepStatus[] = ['completed', 'approved'];
