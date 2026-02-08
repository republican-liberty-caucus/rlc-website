'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';

interface StripeAccountStatus {
  status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed_at: string | null;
  created_at?: string;
}

export default function ChapterBankingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const chapterId = params.id as string;
  const onboardingResult = searchParams.get('onboarding');

  const [accountStatus, setAccountStatus] = useState<StripeAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [chapterId]);

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapterId}/stripe-connect/status`);
      const data = await res.json();
      setAccountStatus(data);
    } catch {
      // Status fetch failed
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboard() {
    setOnboarding(true);
    try {
      const res = await fetch(`/api/v1/admin/chapters/${chapterId}/stripe-connect/onboard`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setOnboarding(false);
    }
  }

  const statusConfig = {
    not_started: { label: 'Not Connected', variant: 'secondary' as const, icon: AlertCircle },
    onboarding: { label: 'Onboarding', variant: 'secondary' as const, icon: Clock },
    active: { label: 'Active', variant: 'default' as const, icon: CheckCircle },
    disabled: { label: 'Disabled', variant: 'destructive' as const, icon: AlertCircle },
  };

  const status = accountStatus?.status || 'not_started';
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.not_started;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banking & Payments"
        description="Manage Stripe Connect for receiving dues distributions"
      />

      {onboardingResult === 'complete' && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800 dark:text-green-200">
              Stripe onboarding submitted. Your account will be activated once verification is complete.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Stripe Connect Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={config.variant}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {config.label}
                </Badge>
              </div>

              {accountStatus?.charges_enabled && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Charges enabled</span>
                </div>
              )}

              {accountStatus?.payouts_enabled && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Payouts enabled</span>
                </div>
              )}

              {accountStatus?.onboarding_completed_at && (
                <p className="text-sm text-muted-foreground">
                  Connected since {new Date(accountStatus.onboarding_completed_at).toLocaleDateString()}
                </p>
              )}

              {status !== 'active' && (
                <Button
                  onClick={handleOnboard}
                  disabled={onboarding}
                  className="mt-4"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {onboarding ? 'Redirecting to Stripe...' : status === 'not_started' ? 'Connect Bank Account' : 'Continue Onboarding'}
                </Button>
              )}

              {status === 'active' && (
                <p className="text-sm text-muted-foreground">
                  Your chapter is receiving automatic dues distributions via Stripe Connect.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
