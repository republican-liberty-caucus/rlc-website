import type { OnboardingStep, OnboardingStepStatus, ChapterOnboardingStep } from '@/types';
import { ONBOARDING_STEPS, STEP_ORDER, DONE_STATUSES, getStepDefinition } from './constants';

type StepState = Pick<ChapterOnboardingStep, 'step' | 'status'>;

export function calculateProgress(steps: StepState[]): { completed: number; total: number; percentage: number } {
  const total = STEP_ORDER.length;
  const completed = steps.filter((s) => DONE_STATUSES.includes(s.status)).length;
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export function areDependenciesMet(step: OnboardingStep, steps: StepState[]): boolean {
  const def = getStepDefinition(step);
  if (!def) return false;
  if (def.dependencies.length === 0) return true;

  const statusMap = new Map(steps.map((s) => [s.step, s.status]));
  return def.dependencies.every((dep) => {
    const depStatus = statusMap.get(dep);
    return depStatus && DONE_STATUSES.includes(depStatus);
  });
}

export function getNextStep(steps: StepState[]): OnboardingStep | null {
  const statusMap = new Map(steps.map((s) => [s.step, s.status]));

  for (const step of STEP_ORDER) {
    const status = statusMap.get(step);
    if (!status || !DONE_STATUSES.includes(status)) {
      if (areDependenciesMet(step, steps)) {
        return step;
      }
    }
  }
  return null;
}

export function canStartStep(step: OnboardingStep, steps: StepState[]): boolean {
  const statusMap = new Map(steps.map((s) => [s.step, s.status]));
  const currentStatus = statusMap.get(step);

  // Can't restart a completed/approved step
  if (currentStatus && DONE_STATUSES.includes(currentStatus)) return false;
  // Can't start a rejected step (needs review action)
  if (currentStatus === 'rejected') return false;

  return areDependenciesMet(step, steps);
}

export function isValidTransition(from: OnboardingStepStatus, to: OnboardingStepStatus, requiresReview: boolean): boolean {
  const transitions: Record<OnboardingStepStatus, OnboardingStepStatus[]> = {
    not_started: ['in_progress'],
    in_progress: ['completed'],
    completed: requiresReview ? ['approved', 'rejected'] : [],
    approved: [],
    rejected: ['in_progress'],
  };
  return transitions[from]?.includes(to) ?? false;
}

export function isOnboardingComplete(steps: StepState[]): boolean {
  return steps.length === STEP_ORDER.length &&
    steps.every((s) => DONE_STATUSES.includes(s.status));
}

export function getAvailableSteps(steps: StepState[]): OnboardingStep[] {
  return STEP_ORDER.filter((step) => {
    const s = steps.find((st) => st.step === step);
    if (s && DONE_STATUSES.includes(s.status)) return false;
    return areDependenciesMet(step, steps);
  });
}

export function isStepEditable(status: OnboardingStepStatus): boolean {
  return status === 'not_started' || status === 'in_progress' || status === 'rejected';
}

export function initializeStepStates(): { step: OnboardingStep; status: OnboardingStepStatus }[] {
  return ONBOARDING_STEPS.map((def) => ({
    step: def.step,
    status: 'not_started' as OnboardingStepStatus,
  }));
}
