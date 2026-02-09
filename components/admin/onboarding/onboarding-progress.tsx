'use client';

import Link from 'next/link';
import { Check, Circle, Clock, AlertCircle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS } from '@/lib/onboarding/constants';
import { calculateProgress, areDependenciesMet } from '@/lib/onboarding/engine';
import type { OnboardingStep, OnboardingStepStatus } from '@/types';

interface StepState {
  step: OnboardingStep;
  status: OnboardingStepStatus;
}

interface OnboardingProgressProps {
  charterId: string;
  charterName: string;
  steps: StepState[];
  activeStep: OnboardingStep | null;
}

const statusIcons: Record<OnboardingStepStatus | 'locked', React.ComponentType<{ className?: string }>> = {
  not_started: Circle,
  in_progress: Clock,
  completed: Clock,
  approved: Check,
  rejected: AlertCircle,
  locked: Lock,
};

const statusColors: Record<OnboardingStepStatus | 'locked', string> = {
  not_started: 'text-muted-foreground',
  in_progress: 'text-rlc-blue',
  completed: 'text-yellow-600',
  approved: 'text-green-600',
  rejected: 'text-red-600',
  locked: 'text-muted-foreground/50',
};

export function OnboardingProgress({ charterId, charterName, steps, activeStep }: OnboardingProgressProps) {
  const { completed, total, percentage } = calculateProgress(steps);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">{charterName}</h2>
        <span className="text-xs rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5">Forming</span>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{completed} of {total} steps</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-rlc-red transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <nav className="space-y-1">
        {ONBOARDING_STEPS.map((def, idx) => {
          const stepState = steps.find((s) => s.step === def.step);
          const status = stepState?.status || 'not_started';
          const depsOk = areDependenciesMet(def.step, steps);
          const effectiveStatus = (!depsOk && status === 'not_started') ? 'locked' : status;
          const isActive = activeStep === def.step;
          const Icon = statusIcons[effectiveStatus];

          return (
            <Link
              key={def.step}
              href={effectiveStatus === 'locked' ? '#' : `/admin/charters/${charterId}/onboarding?step=${def.step}`}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive && 'bg-rlc-red/10 text-rlc-red font-medium',
                !isActive && effectiveStatus !== 'locked' && 'hover:bg-muted',
                effectiveStatus === 'locked' && 'cursor-not-allowed opacity-50'
              )}
              onClick={(e) => effectiveStatus === 'locked' && e.preventDefault()}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', statusColors[effectiveStatus])} />
              <span className="flex-1">
                <span className="text-xs text-muted-foreground mr-1">{idx + 1}.</span>
                {def.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
