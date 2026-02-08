import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getMemberByClerkId, getMemberContributionTotal } from '@/lib/supabase/server';
import { getTierConfig } from '@/lib/stripe/client';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { MembershipTier } from '@/types';
import { User, CreditCard, Calendar, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your RLC member dashboard',
};

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const member = await getMemberByClerkId(userId);

  // If no member record exists yet, show onboarding
  if (!member) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">Welcome to the RLC!</h1>
          <p className="mb-6 text-muted-foreground">
            Your account has been created. Complete your profile to get started.
          </p>
          <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
            <Link href="/profile">Complete Your Profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  const contributionTotal = await getMemberContributionTotal(member.id);
  const tierConfig = getTierConfig(member.membership_tier as MembershipTier);
  const tierDisplayName = tierConfig?.name || member.membership_tier;

  const membershipStatusColors: Record<string, string> = {
    new_member: 'bg-blue-100 text-blue-800',
    current: 'bg-green-100 text-green-800',
    grace: 'bg-yellow-100 text-yellow-800',
    expired: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-gray-100 text-gray-800',
    deceased: 'bg-gray-100 text-gray-800',
    expiring: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Welcome back, {member.first_name}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Here&apos;s an overview of your RLC membership.
        </p>
      </div>

      {/* Membership Status Card */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold">Membership Status</h2>
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  membershipStatusColors[member.membership_status] || 'bg-gray-100'
                }`}
              >
                {member.membership_status === 'new_member' ? 'New' : member.membership_status.charAt(0).toUpperCase() + member.membership_status.slice(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                {tierDisplayName} Member
              </span>
            </div>
            {member.membership_expiry_date && (
              <p className="mt-2 text-sm text-muted-foreground">
                {member.membership_status === 'current'
                  ? `Renews on ${formatDate(member.membership_expiry_date)}`
                  : `Expired on ${formatDate(member.membership_expiry_date)}`}
              </p>
            )}
          </div>
          {member.membership_status !== 'current' && member.membership_status !== 'new_member' && (
            <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
              <Link href="/join">Renew Membership</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rlc-red/10">
              <User className="h-5 w-5 text-rlc-red" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-semibold">
                {member.membership_join_date
                  ? formatDate(member.membership_join_date)
                  : member.membership_start_date
                    ? formatDate(member.membership_start_date)
                    : formatDate(member.created_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rlc-blue/10">
              <CreditCard className="h-5 w-5 text-rlc-blue" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contributions</p>
              <p className="font-semibold">{formatCurrency(contributionTotal)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rlc-gold/10">
              <Calendar className="h-5 w-5 text-rlc-gold" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Events Attended</p>
              <p className="font-semibold">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/membership"
          className="group flex items-center justify-between rounded-lg border bg-card p-6 transition-colors hover:border-rlc-red"
        >
          <div>
            <h3 className="font-semibold group-hover:text-rlc-red">Manage Membership</h3>
            <p className="text-sm text-muted-foreground">
              View your tier, renewal date, and upgrade options
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-rlc-red" />
        </Link>

        <Link
          href="/profile"
          className="group flex items-center justify-between rounded-lg border bg-card p-6 transition-colors hover:border-rlc-red"
        >
          <div>
            <h3 className="font-semibold group-hover:text-rlc-red">Update Profile</h3>
            <p className="text-sm text-muted-foreground">
              Keep your contact information up to date
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-rlc-red" />
        </Link>

        <Link
          href="/contributions"
          className="group flex items-center justify-between rounded-lg border bg-card p-6 transition-colors hover:border-rlc-red"
        >
          <div>
            <h3 className="font-semibold group-hover:text-rlc-red">View Contributions</h3>
            <p className="text-sm text-muted-foreground">
              See your donation and payment history
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-rlc-red" />
        </Link>

        <Link
          href="/my-events"
          className="group flex items-center justify-between rounded-lg border bg-card p-6 transition-colors hover:border-rlc-red"
        >
          <div>
            <h3 className="font-semibold group-hover:text-rlc-red">My Events</h3>
            <p className="text-sm text-muted-foreground">
              View upcoming and past event registrations
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-rlc-red" />
        </Link>

        <Link
          href="/chapters"
          className="group flex items-center justify-between rounded-lg border bg-card p-6 transition-colors hover:border-rlc-red"
        >
          <div>
            <h3 className="font-semibold group-hover:text-rlc-red">Find Your Chapter</h3>
            <p className="text-sm text-muted-foreground">
              Connect with your local RLC chapter
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-rlc-red" />
        </Link>
      </div>
    </div>
  );
}
