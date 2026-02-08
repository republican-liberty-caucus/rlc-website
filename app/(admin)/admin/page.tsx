import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
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

/** Apply chapter scoping to a Supabase query builder */
function scopeByChapter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  visibleChapterIds: string[] | null,
  column: string = 'primary_chapter_id'
): T {
  if (visibleChapterIds !== null && visibleChapterIds.length > 0) {
    return query.in(column, visibleChapterIds);
  }
  return query;
}

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  totalChapters: number;
  upcomingEvents: number;
  monthlyContributions: number;
  newMembersThisMonth: number;
  membersByTier: Record<string, number>;
  membersByStatus: Record<string, number>;
  expiringIn30Days: number;
}

async function getDashboardStats(visibleChapterIds: string[] | null): Promise<DashboardStats> {
  const supabase = createServerClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Run all independent queries in parallel
  const results = await Promise.all([
    // Total members
    scopeByChapter(
      supabase.from('rlc_members').select('*', { count: 'exact', head: true }),
      visibleChapterIds
    ),
    // Active members
    scopeByChapter(
      supabase.from('rlc_members').select('*', { count: 'exact', head: true }).eq('membership_status', 'current'),
      visibleChapterIds
    ),
    // Active chapters
    scopeByChapter(
      supabase.from('rlc_chapters').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      visibleChapterIds, 'id'
    ),
    // Upcoming events
    scopeByChapter(
      supabase.from('rlc_events').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('start_date', new Date().toISOString()),
      visibleChapterIds, 'chapter_id'
    ),
    // Monthly contributions
    scopeByChapter(
      supabase.from('rlc_contributions').select('amount').eq('payment_status', 'completed').gte('created_at', startOfMonth.toISOString()),
      visibleChapterIds, 'chapter_id'
    ),
    // New members this month
    scopeByChapter(
      supabase.from('rlc_members').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
      visibleChapterIds
    ),
    // Members by tier
    scopeByChapter(
      supabase.from('rlc_members').select('membership_tier'),
      visibleChapterIds
    ),
    // Members by status
    scopeByChapter(
      supabase.from('rlc_members').select('membership_status'),
      visibleChapterIds
    ),
    // Expiring in 30 days
    scopeByChapter(
      supabase.from('rlc_members').select('*', { count: 'exact', head: true })
        .in('membership_status', ['current', 'expiring'])
        .lte('membership_expiry_date', thirtyDaysFromNow.toISOString())
        .gte('membership_expiry_date', new Date().toISOString()),
      visibleChapterIds
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
    chapterResult,
    eventsResult,
    contribResult,
    newResult,
    tierResult,
    statusResult,
    expiringResult,
  ] = results;

  const monthlyContributions = (contribResult.data || []).reduce(
    (sum, c) => sum + Number((c as { amount: number }).amount),
    0
  );

  const membersByTier: Record<string, number> = {};
  for (const row of (tierResult.data || []) as { membership_tier: string }[]) {
    membersByTier[row.membership_tier] = (membersByTier[row.membership_tier] || 0) + 1;
  }

  const membersByStatus: Record<string, number> = {};
  for (const row of (statusResult.data || []) as { membership_status: string }[]) {
    membersByStatus[row.membership_status] = (membersByStatus[row.membership_status] || 0) + 1;
  }

  return {
    totalMembers: totalResult.count || 0,
    activeMembers: activeResult.count || 0,
    totalChapters: chapterResult.count || 0,
    upcomingEvents: eventsResult.count || 0,
    monthlyContributions,
    newMembersThisMonth: newResult.count || 0,
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

async function getRecentActivity(visibleChapterIds: string[] | null) {
  const supabase = createServerClient();

  const [membersResult, contribResult] = await Promise.all([
    scopeByChapter(
      supabase.from('rlc_members')
        .select('id, first_name, last_name, email, created_at, membership_tier')
        .order('created_at', { ascending: false })
        .limit(5),
      visibleChapterIds
    ),
    scopeByChapter(
      supabase.from('rlc_contributions')
        .select(`
          id, amount, contribution_type, payment_status, created_at,
          member:rlc_members(first_name, last_name)
        `)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5),
      visibleChapterIds, 'chapter_id'
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
  grace: 'Grace',
  expired: 'Expired',
  pending: 'Pending',
  cancelled: 'Cancelled',
  deceased: 'Deceased',
  expiring: 'Expiring',
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
    getDashboardStats(ctx.visibleChapterIds),
    getRecentActivity(ctx.visibleChapterIds),
  ]);

  const totalForBars = stats.totalMembers || 1;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={ctx.isNational ? 'National overview' : `Viewing ${ctx.visibleChapterIds?.length || 0} chapter(s)`}
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
          label="Active Chapters"
          value={stats.totalChapters}
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
                const pct = totalForBars > 0 ? (count / totalForBars) * 100 : 0;
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
                const pct = totalForBars > 0 ? (count / totalForBars) * 100 : 0;
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
