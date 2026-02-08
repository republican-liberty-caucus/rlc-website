'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { StepActions } from './step-actions';
import { isStepEditable } from '@/lib/onboarding/engine';
import type { OnboardingStepStatus } from '@/types';

interface StripeConnectStepProps {
  chapterId: string;
  data: Record<string, unknown>;
  status: OnboardingStepStatus;
  isNational: boolean;
  saving: boolean;
  onSaveDraft: (data: Record<string, unknown>) => void;
  onComplete: (data: Record<string, unknown>) => void;
}

export function StripeConnectStep({
  chapterId,
  data,
  status,
  isNational,
  saving,
  onSaveDraft,
  onComplete,
}: StripeConnectStepProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const stripeAccountId = data.stripe_account_id as string | undefined;
  const onboardingComplete = data.onboarding_complete as boolean | undefined;
  const isEditable = isStepEditable(status);

  async function handleStartOnboarding() {
    setConnecting(true);
    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapterId}/stripe-connect/onboard`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to start Stripe onboarding' }));
        throw new Error(err.error);
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start Stripe onboarding',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  }

  async function handleCheckStatus() {
    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapterId}/stripe-connect/status`);
      if (!res.ok) throw new Error('Failed to check status');

      const { account } = await res.json();
      if (account?.charges_enabled && account?.payouts_enabled) {
        onComplete({
          stripe_account_id: account.stripe_account_id,
          onboarding_complete: true,
        });
      } else {
        toast({
          title: 'Not ready',
          description: 'Stripe onboarding is not yet complete. Please finish the Stripe setup first.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check status',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Stripe Connect</h3>
        <p className="text-sm text-muted-foreground">
          Connect a Stripe account so the chapter can process dues and receive payouts.
        </p>
      </div>

      {onboardingComplete ? (
        <div className="rounded-md border bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">Stripe Connect active</p>
          {stripeAccountId && (
            <p className="text-green-700 font-mono text-xs mt-1">{stripeAccountId}</p>
          )}
        </div>
      ) : stripeAccountId ? (
        <div className="rounded-md border bg-yellow-50 p-4 text-sm">
          <p className="font-medium text-yellow-800">Stripe onboarding in progress</p>
          <p className="text-yellow-700 font-mono text-xs mt-1">{stripeAccountId}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleStartOnboarding} disabled={connecting}>
              {connecting ? 'Opening...' : 'Continue Onboarding'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCheckStatus}>
              Check Status
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground mb-3">
            No Stripe account connected yet. Click below to start the Stripe Express onboarding process.
          </p>
          {isEditable && (
            <Button onClick={handleStartOnboarding} disabled={connecting} className="bg-rlc-red hover:bg-rlc-red/90">
              {connecting ? 'Starting...' : 'Start Stripe Connect'}
            </Button>
          )}
        </div>
      )}

      <StepActions
        status={status}
        requiresReview={false}
        isNational={isNational}
        saving={saving}
        onSaveDraft={() => onSaveDraft({ stripe_account_id: stripeAccountId, onboarding_complete: onboardingComplete })}
        onComplete={() => onComplete({ stripe_account_id: stripeAccountId, onboarding_complete: true })}
      />
    </div>
  );
}
