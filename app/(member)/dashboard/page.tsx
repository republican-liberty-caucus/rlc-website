import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getMemberByClerkId, getMemberContributionTotal } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';
import { getTierConfig } from '@/lib/stripe/client';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ImpactSummary } from '@/components/dashboard/impact-summary';
import { UrgentActions } from '@/components/dashboard/urgent-actions';
import { MyRepsPreview } from '@/components/dashboard/my-reps-preview';
import { ActivityTimeline } from '@/components/dashboard/activity-timeline';
import { PromoteSection } from '@/components/dashboard/promote-section';
import type { ActivityItem } from '@/components/dashboard/activity-timeline';
import type { MembershipTier, ShareKit } from '@/types';
import { ArrowRight, Shield, CreditCard, Calendar, User, Users } from 'lucide-react';
import { logger } from '@/lib/logger';

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
          <h1 className="mb-4 font-heading text-2xl font-bold">Welcome to the RLC!</h1>
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

  const supabase = createServerClient();

  // Parallel data fetching
  const [
    contributionTotal,
    participationsResult,
    registrationsResult,
    activeCampaignsResult,
    contributionsResult,
    shareKitsResult,
  ] = await Promise.all([
    getMemberContributionTotal(member.id),
    supabase
      .from('rlc_campaign_participations')
      .select('id, action, created_at, legislator_id, campaign:rlc_action_campaigns(title, slug)')
      .eq('contact_id', member.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('rlc_event_registrations')
      .select('id, created_at, event:rlc_events(title, slug)')
      .eq('contact_id', member.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('rlc_action_campaigns')
      .select('id, title, slug, description')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('rlc_contributions')
      .select('id, contribution_type, amount, created_at')
      .eq('contact_id', member.id)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('rlc_share_kits')
      .select('id, content_type, content_id, title, description, social_copy, og_image_url, og_image_override_url, status, scope, charter_id, created_by, created_at, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const dataErrors: string[] = [];
  if (participationsResult.error) {
    logger.error('Error fetching participations:', participationsResult.error);
    dataErrors.push('campaign activity');
  }
  if (registrationsResult.error) {
    logger.error('Error fetching registrations:', registrationsResult.error);
    dataErrors.push('event registrations');
  }
  if (activeCampaignsResult.error) {
    logger.error('Error fetching campaigns:', activeCampaignsResult.error);
    dataErrors.push('active campaigns');
  }
  if (contributionsResult.error) {
    logger.error('Error fetching contributions:', contributionsResult.error);
    dataErrors.push('contributions');
  }
  if (shareKitsResult.error) {
    logger.error('Error fetching share kits:', shareKitsResult.error);
    dataErrors.push('share kits');
  }

  const participations = (participationsResult.data || []) as Array<{
    id: string;
    action: string;
    created_at: string;
    legislator_id: string | null;
    campaign: { title: string; slug: string } | null;
  }>;
  const registrations = (registrationsResult.data || []) as Array<{
    id: string;
    created_at: string;
    event: { title: string; slug: string } | null;
  }>;
  const activeCampaigns = (activeCampaignsResult.data || []) as Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
  }>;
  const contributions = (contributionsResult.data || []) as Array<{
    id: string;
    contribution_type: string;
    amount: number;
    created_at: string;
  }>;
  const activeShareKits = (shareKitsResult.data || []) as ShareKit[];

  // Impact stats
  const campaignIds = new Set(participations.map((p) => p.campaign?.slug).filter(Boolean));
  const repsContacted = new Set(participations.map((p) => p.legislator_id).filter(Boolean)).size;
  const eventsAttended = registrations.length;
  const totalActions = participations.length;

  // Urgent actions: active campaigns member hasn't acted on
  const participatedCampaignIds = new Set(
    participations.map((p) => {
      // Join resolves to an object — extract the campaign id from the parent row
      // The participation row itself has campaign_id but that's not in our select
      return p.campaign?.slug;
    }).filter(Boolean)
  );
  const urgentCampaigns = activeCampaigns
    .filter((c) => !participatedCampaignIds.has(c.slug))
    .slice(0, 3);

  // Build activity timeline
  const activityItems: ActivityItem[] = [];

  for (const p of participations.slice(0, 10)) {
    activityItems.push({
      id: p.id,
      type: 'campaign',
      title: p.campaign?.title || 'Campaign Action',
      description: `You ${p.action || 'took action'}`,
      timestamp: p.created_at,
      href: p.campaign?.slug ? `/action-center/contact?campaign=${p.campaign.slug}` : undefined,
    });
  }

  const typeLabels: Record<string, string> = {
    membership: 'Membership payment',
    donation: 'Donation',
    event_registration: 'Event registration fee',
    merchandise: 'Merchandise purchase',
  };

  for (const c of contributions.slice(0, 10)) {
    activityItems.push({
      id: c.id,
      type: 'contribution',
      title: typeLabels[c.contribution_type] || 'Contribution',
      description: `$${(c.amount / 100).toFixed(2)}`,
      timestamp: c.created_at,
      href: '/contributions',
    });
  }

  for (const r of registrations.slice(0, 10)) {
    activityItems.push({
      id: r.id,
      type: 'event',
      title: r.event?.title || 'Event Registration',
      description: 'Registered for event',
      timestamp: r.created_at,
      href: r.event?.slug ? `/events/${r.event.slug}` : undefined,
    });
  }

  activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Membership info
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

  const statusLabel =
    member.membership_status === 'new_member'
      ? 'New'
      : member.membership_status.charAt(0).toUpperCase() + member.membership_status.slice(1);

  // Build address string for civic API lookup
  const memberAddress =
    member.address_line1 && member.city && member.state && member.postal_code
      ? `${member.address_line1}, ${member.city}, ${member.state} ${member.postal_code}`
      : null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold">
          Welcome back, {member.first_name}!
        </h1>
        <p className="mt-1 text-muted-foreground">
          Your liberty action dashboard
        </p>
      </div>

      {/* Data load warning */}
      {dataErrors.length > 0 && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          Some dashboard data could not be loaded ({dataErrors.join(', ')}).
          Try refreshing the page.
        </div>
      )}

      {/* Impact Summary — animated counters */}
      <div className="mb-6">
        <ImpactSummary
          campaignsActedOn={campaignIds.size}
          repsContacted={repsContacted}
          eventsAttended={eventsAttended}
          totalActions={totalActions}
        />
      </div>

      {/* Urgent Actions */}
      <div className="mb-6">
        <UrgentActions campaigns={urgentCampaigns} />
      </div>

      {/* Promote — share endorsements, campaigns, events */}
      {activeShareKits.length > 0 && (
        <div className="mb-6">
          <PromoteSection shareKits={activeShareKits} />
        </div>
      )}

      {/* Two-column layout: Reps + Membership Card */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Your Reps */}
        <MyRepsPreview memberAddress={memberAddress} memberState={member.state} />

        {/* Membership Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-rlc-red" />
              <h2 className="font-heading text-lg font-semibold">Membership</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    membershipStatusColors[member.membership_status] || 'bg-gray-100'
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tier</span>
                <span className="text-sm font-medium">{tierDisplayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm font-medium">
                  {member.membership_join_date
                    ? formatDate(member.membership_join_date)
                    : member.membership_start_date
                      ? formatDate(member.membership_start_date)
                      : formatDate(member.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Contributions</span>
                <span className="text-sm font-medium">{formatCurrency(contributionTotal)}</span>
              </div>
              {member.membership_expiry_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {member.membership_status === 'current' ? 'Renews' : 'Expired'}
                  </span>
                  <span className="text-sm font-medium">
                    {formatDate(member.membership_expiry_date)}
                  </span>
                </div>
              )}
            </div>
            {member.membership_status !== 'current' && member.membership_status !== 'new_member' && (
              <Button asChild className="mt-4 w-full bg-rlc-red hover:bg-rlc-red/90" size="sm">
                <Link href="/join">Renew Membership</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <div className="mb-6">
        <ActivityTimeline items={activityItems.slice(0, 15)} />
      </div>

      {/* Quick Links — deprioritized below engagement content */}
      <div>
        <h2 className="mb-4 font-heading text-lg font-semibold">Quick Links</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: '/action-center', label: 'Action Center', desc: 'Contact reps & take action', icon: <Users className="h-4 w-4" /> },
            { href: '/scorecards', label: 'Liberty Scorecards', desc: 'See how legislators voted', icon: <Shield className="h-4 w-4" /> },
            { href: '/membership', label: 'Manage Membership', desc: 'Tier, renewal & upgrades', icon: <CreditCard className="h-4 w-4" /> },
            { href: '/profile', label: 'Update Profile', desc: 'Contact info & preferences', icon: <User className="h-4 w-4" /> },
            { href: '/contributions', label: 'Contributions', desc: 'Donation & payment history', icon: <CreditCard className="h-4 w-4" /> },
            { href: '/my-events', label: 'My Events', desc: 'Upcoming & past events', icon: <Calendar className="h-4 w-4" /> },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-rlc-red"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-rlc-red/10 group-hover:text-rlc-red">
                {link.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium group-hover:text-rlc-red">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-rlc-red" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
