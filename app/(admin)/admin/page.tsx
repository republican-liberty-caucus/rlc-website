import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { rpc } from '@/lib/supabase/rpc';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Users, MapPin, Calendar, CreditCard, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'RLC Admin Dashboard',
};

/** Apply charter scoping to a Supabase query builder */
function scopeByCharter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  visibleCharterIds: string[] | null,
  column: string = 'primary_charter_id'
): T {
  if (visibleCharterIds !== null && visibleCharterIds.length > 0) {
    return query.in(column, visibleCharterIds);
  }
  return query;
}

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalCharters: number;
  upcomingEvents: number;
  monthlyContributions: number;
  newMembersThisMonth: number;
  membersByTier: Record<string, number>;
  membersByStatus: Record<string, number>;
  expiringIn30Days: number;
}

async function getDashboardStats(visibleCharterIds: string[] | null): Promise<DashboardStats> {
  const supabase = createServerClient();
  const rpcCharterIds = visibleCharterIds ?? undefined;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfMonthISO = startOfMonth.toISOString();
  const nowISO = new Date().toISOString();

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Run all independent queries in parallel
  const results = await Promise.all([
    // 0: Total members (all statuses — head-only count, no row limit)
    scopeByCharter(
      supabase.from('rlc_contacts').select('*', { count: 'exact', head: true }),
      visibleCharterIds
    ),
    // 1: Active members (current only — head-only count)
    scopeByCharter(
      supabase.from('rlc_contacts').select('*', { count: 'exact', head: true }).eq('membership_status', 'current'),
      visibleCharterIds
    ),
    // 2: Active charters (head-only count)
    scopeByCharter(
      supabase.from('rlc_charters').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      visibleCharterIds, 'id'
    ),
    // 3: Upcoming events (head-only count)
    scopeByCharter(
      supabase.from('rlc_events').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('start_date', nowISO),
      visibleCharterIds, 'charter_id'
    ),
    // 4: Monthly contributions — RPC to avoid 1000-row limit
    rpc<{ total_amount: number; contribution_type: string }[]>(supabase, 'get_contribution_summary', {
      p_start_date: startOfMonthISO,
      p_end_date: nowISO,
      p_charter_ids: rpcCharterIds,
    }),
    // 5: New members this month — RPC uses membership_join_date (not created_at)
    rpc<number>(supabase, 'get_new_members_count', {
      p_start_date: startOfMonthISO,
      p_end_date: nowISO,
      p_charter_ids: rpcCharterIds,
    }),
    // 6: Members by tier (current only) — RPC to avoid 1000-row limit
    rpc<{ membership_tier: string; count: number }[]>(supabase, 'get_members_by_tier', { p_charter_ids: rpcCharterIds }),
    // 7: Members by status (all) — RPC to avoid 1000-row limit
    rpc<{ membership_status: string; count: number }[]>(supabase, 'get_members_by_status', { p_charter_ids: rpcCharterIds }),
    // 8: Expiring in 30 days (head-only count)
    scopeByCharter(
      supabase.from('rlc_contacts').select('*', { count: 'exact', head: true })
        .in('membership_status', ['current', 'expiring'])
        .lte('membership_expiry_date', thirtyDaysFromNow.toISOString())
        .gte('membership_expiry_date', nowISO),
      visibleCharterIds
    ),
  ]);

  // Check for query errors — surface instead of showing false zeroes
  const queryError = results.find((r) => r.error);
  if (queryError?.error) {
    throw new Error(`Dashboard query failed: ${queryError.error.message}`);
  }

  const [
    totalResult,
    activeResult,
    charterResult,
    eventsResult,
    contribResult,
    newMembersResult,
    tierResult,
    statusResult,
    expiringResult,
  ] = results;

  // Monthly contributions from RPC: sum total_amount across contribution types
  const monthlyContributions = (contribResult.data || []).reduce(
    (sum: number, row: { total_amount: number }) => sum + Number(row.total_amount),
    0
  );

  // Members by tier from RPC: [{membership_tier, count}] — pre-aggregated
  const membersByTier: Record<string, number> = {};
  for (const row of (tierResult.data || []) as { membership_tier: string; count: number }[]) {
    membersByTier[row.membership_tier] = Number(row.count);
  }

  // Members by status from RPC: [{membership_status, count}] — pre-aggregated
  const membersByStatus: Record<string, number> = {};
  for (const row of (statusResult.data || []) as { membership_status: string; count: number }[]) {
    membersByStatus[row.membership_status] = Number(row.count);
  }

  return {
    totalMembers: totalResult.count || 0,
    activeMembers: activeResult.count || 0,
    totalCharters: charterResult.count || 0,
    upcomingEvents: eventsResult.count || 0,
    monthlyContributions,
    newMembersThisMonth: Number(newMembersResult.data) || 0,
    membersByTier,
    membersByStatus,
    expiringIn30Days: expiringResult.count || 0,
  };
}

interface RecentMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  membership_tier: string;
}

interface RecentContribution {
  id: string;
  amount: number;
  contribution_type: string;
  payment_status: string;
  created_at: string;
  member: { first_name: string; last_name: string } | null;
}

async function getRecentActivity(visibleCharterIds: string[] | null) {
  const supabase = createServerClient();

  const [membersResult, contribResult] = await Promise.all([
    scopeByCharter(
      supabase.from('rlc_contacts')
        .select('id, first_name, last_name, email, created_at, membership_tier')
        .order('created_at', { ascending: false })
        .limit(5),
      visibleCharterIds
    ),
    scopeByCharter(
      supabase.from('rlc_contributions')
        .select(`
          id, amount, contribution_type, payment_status, created_at,
          member:rlc_contacts(first_name, last_name)
        `)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5),
      visibleCharterIds, 'charter_id'
    ),
  ]);

  const activityError = membersResult.error || contribResult.error;
  if (activityError) {
    throw new Error(`Recent activity query failed: ${activityError.message}`);
  }

  return {
    recentMembers: (membersResult.data || []) as RecentMember[],
    recentContributions: (contribResult.data || []) as RecentContribution[],
  };
}

const TIER_LABELS: Record<string, string> = {
  student_military: 'Student/Military',
  individual: 'Individual',
  premium: 'Premium',
  sustaining: 'Sustaining',
  patron: 'Patron',
  benefactor: 'Benefactor',
  roundtable: 'Roundtable',
};

const STATUS_LABELS: Record<string, string> = {
  new_member: 'New',
  current: 'Current',
  expiring: 'Expiring',
  grace: 'Grace',
  expired: 'Expired',
  cancelled: 'Cancelled',
  deceased: 'Deceased',
  pending: 'Pending',
};

const STATUS_COLORS: Record<string, string> = {
  new_member: 'bg-blue-500',
  current: 'bg-green-500',
  grace: 'bg-yellow-500',
  expired: 'bg-red-500',
  pending: 'bg-yellow-400',
  cancelled: 'bg-gray-400',
  deceased: 'bg-gray-300',
  expiring: 'bg-orange-500',
};

export default async function AdminDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const [stats, activity] = await Promise.all([
    getDashboardStats(ctx.visibleCharterIds),
    getRecentActivity(ctx.visibleCharterIds),
  ]);

  // Tier chart denominator: sum of current-only tier counts (from RPC)
  const totalCurrentMembers = Object.values(stats.membersByTier).reduce((a, b) => a + b, 0) || 1;
  // Status chart denominator: sum of all-status counts (from RPC)
  const totalAllStatuses = Object.values(stats.membersByStatus).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={ctx.isNational ? 'National overview' : `Viewing ${ctx.visibleCharterIds?.length || 0} charter(s)`}
        className="mb-8"
      />

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={stats.totalMembers.toLocaleString()}
          icon={<Users className="h-5 w-5 text-rlc-red" />}
          description={`${stats.activeMembers.toLocaleString()} active`}
        />
        <StatCard
          label="Active Charters"
          value={stats.totalCharters}
          icon={<MapPin className="h-5 w-5 text-rlc-blue" />}
        />
        <StatCard
          label="Upcoming Events"
          value={stats.upcomingEvents}
          icon={<Calendar className="h-5 w-5 text-rlc-blue" />}
        />
        <StatCard
          label="This Month"
          value={formatCurrency(stats.monthlyContributions)}
          icon={<CreditCard className="h-5 w-5 text-green-600" />}
          trend={{ value: `${stats.newMembersThisMonth} new members`, direction: 'up' }}
        />
      </div>

      {/* Expiring Alert */}
      {stats.expiringIn30Days > 0 && (
        <div className="mb-8 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600" />
          <p className="text-sm text-orange-800 dark:text-orange-200">
            <span className="font-semibold">{stats.expiringIn30Days}</span> membership{stats.expiringIn30Days !== 1 ? 's' : ''} expiring in the next 30 days.
          </p>
          <Link href="/admin/members?status=expiring" className="ml-auto text-sm font-medium text-orange-700 hover:underline dark:text-orange-300">
            View
          </Link>
        </div>
      )}

      {/* Breakdown Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {/* Members by Tier */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-heading font-semibold">Members by Tier</h2>
            <div className="space-y-3">
              {Object.entries(TIER_LABELS).map(([key, label]) => {
                const count = stats.membersByTier[key] || 0;
                const pct = (count / totalCurrentMembers) * 100;
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{label}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-rlc-red transition-all"
                        style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Members by Status */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-heading font-semibold">Members by Status</h2>
            <div className="space-y-3">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const count = stats.membersByStatus[key] || 0;
                const pct = (count / totalAllStatuses) * 100;
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{label}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${STATUS_COLORS[key] || 'bg-gray-400'}`}
                        style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Members */}
        <Card>
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-heading font-semibold">Recent Members</h2>
            <Link href="/admin/members" className="text-sm text-rlc-red hover:underline">
              View all
            </Link>
          </div>
          <CardContent className="p-6">
            {activity.recentMembers.length > 0 ? (
              <ul className="space-y-3">
                {activity.recentMembers.map((member) => (
                  <li key={member.id} className="flex items-center justify-between">
                    <div>
                      <Link href={`/admin/members/${member.id}`} className="font-medium hover:text-rlc-red">
                        {member.first_name} {member.last_name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{member.membership_tier.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-muted-foreground">No recent members</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Contributions */}
        <Card>
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-heading font-semibold">Recent Contributions</h2>
            <Link href="/admin/reports" className="text-sm text-rlc-red hover:underline">
              View all
            </Link>
          </div>
          <CardContent className="p-6">
            {activity.recentContributions.length > 0 ? (
              <ul className="space-y-3">
                {activity.recentContributions.map((contribution) => (
                  <li key={contribution.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {contribution.member
                          ? `${contribution.member.first_name} ${contribution.member.last_name}`
                          : 'Anonymous'}
                      </p>
                      <p className="text-sm capitalize text-muted-foreground">
                        {contribution.contribution_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(Number(contribution.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-muted-foreground">No recent contributions</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
