import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getMemberByClerkId, getMemberContributionTotal } from '@/lib/supabase/server';
import { getTierConfig, MEMBERSHIP_TIERS, formatPrice } from '@/lib/stripe/client';
import { formatDate } from '@/lib/utils';
import type { MembershipTier } from '@/types';
import { Shield, Calendar, CreditCard, ArrowUpRight, Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Membership',
  description: 'Manage your RLC membership tier and renewal',
};

export default async function MembershipPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const member = await getMemberByClerkId(userId);

  if (!member) {
    redirect('/dashboard');
  }

  const tierConfig = getTierConfig(member.membership_tier as MembershipTier);
  const contributionTotal = await getMemberContributionTotal(member.id);

  const statusLabels: Record<string, { label: string; color: string; description: string }> = {
    new_member: {
      label: 'New Member',
      color: 'bg-blue-100 text-blue-800',
      description: 'Welcome! Your membership is active.',
    },
    current: {
      label: 'Current',
      color: 'bg-green-100 text-green-800',
      description: 'Your membership is active and in good standing.',
    },
    grace: {
      label: 'Grace Period',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Your membership has expired but you are in a grace period. Renew now to maintain your benefits.',
    },
    expired: {
      label: 'Expired',
      color: 'bg-red-100 text-red-800',
      description: 'Your membership has expired. Renew to regain access to member benefits.',
    },
    pending: {
      label: 'Pending',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Your membership payment is being processed.',
    },
    cancelled: {
      label: 'Cancelled',
      color: 'bg-gray-100 text-gray-800',
      description: 'Your membership has been cancelled. Join again to restore your benefits.',
    },
    expiring: {
      label: 'Expiring Soon',
      color: 'bg-orange-100 text-orange-800',
      description: 'Your membership is expiring soon. Renew now to continue your benefits without interruption.',
    },
    deceased: {
      label: 'Inactive',
      color: 'bg-gray-100 text-gray-800',
      description: 'This membership is no longer active.',
    },
  };

  const status = statusLabels[member.membership_status] || {
    label: member.membership_status,
    color: 'bg-gray-100',
    description: '',
  };

  // Find upgrade tiers (tiers with higher price than current)
  const currentPrice = tierConfig?.price || 0;
  const upgradeTiers = MEMBERSHIP_TIERS.filter((t) => t.price > currentPrice);

  const needsRenewal = ['grace', 'expired', 'cancelled', 'expiring'].includes(
    member.membership_status
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Membership</h1>
        <p className="mt-2 text-muted-foreground">
          View and manage your RLC membership.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Current Membership Card */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rlc-red/10">
                <Shield className="h-6 w-6 text-rlc-red" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {tierConfig?.name || member.membership_tier} Membership
                </h2>
                <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
            </div>
            {tierConfig && (
              <div className="text-right">
                <p className="text-2xl font-bold">{formatPrice(tierConfig.price)}</p>
                <p className="text-sm text-muted-foreground">/year</p>
              </div>
            )}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{status.description}</p>

          {/* Membership Dates */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm font-medium">
                  {member.membership_join_date
                    ? formatDate(member.membership_join_date)
                    : member.membership_start_date
                      ? formatDate(member.membership_start_date)
                      : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Current Period Start</p>
                <p className="text-sm font-medium">
                  {member.membership_start_date
                    ? formatDate(member.membership_start_date)
                    : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">
                  {needsRenewal ? 'Expired On' : 'Renews On'}
                </p>
                <p className="text-sm font-medium">
                  {member.membership_expiry_date
                    ? formatDate(member.membership_expiry_date)
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Tier Features */}
          {tierConfig && (
            <div className="mt-6 border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Your Benefits
              </h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {tierConfig.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 shrink-0 text-rlc-red" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Renewal CTA */}
          {needsRenewal && (
            <div className="mt-6 border-t pt-4">
              <Button asChild className="w-full bg-rlc-red hover:bg-rlc-red/90 sm:w-auto">
                <Link href="/join">Renew Membership</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Contribution Summary */}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rlc-blue/10">
                <CreditCard className="h-5 w-5 text-rlc-blue" />
              </div>
              <div>
                <h3 className="font-semibold">Total Contributions</h3>
                <p className="text-2xl font-bold">
                  ${contributionTotal.toFixed(2)}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/contributions">
                View History
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Upgrade Options */}
        {upgradeTiers.length > 0 && !needsRenewal && (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Upgrade Your Membership</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Unlock additional benefits by upgrading to a higher tier.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {upgradeTiers.slice(0, 4).map((tier) => (
                <Link
                  key={tier.tier}
                  href={`/join?tier=${tier.tier}`}
                  className="group flex items-center justify-between rounded-md border p-4 transition-colors hover:border-rlc-red"
                >
                  <div>
                    <p className="font-medium group-hover:text-rlc-red">{tier.name}</p>
                    <p className="text-sm text-muted-foreground">{tier.description}</p>
                  </div>
                  <p className="ml-4 whitespace-nowrap font-semibold">
                    {formatPrice(tier.price)}/yr
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
