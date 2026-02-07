import { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { Users, MapPin, Calendar, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'RLC Admin Dashboard',
};

async function getDashboardStats() {
  const supabase = createServerClient();

  // Get member counts
  const { count: totalMembers } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true });

  const { count: activeMembers } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .eq('membership_status', 'active');

  // Get chapter count
  const { count: totalChapters } = await supabase
    .from('rlc_chapters')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Get upcoming events
  const { count: upcomingEvents } = await supabase
    .from('rlc_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('start_date', new Date().toISOString());

  // Get contribution totals (this month)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('rlc_contributions')
    .select('amount')
    .eq('payment_status', 'completed')
    .gte('created_at', startOfMonth.toISOString());

  const monthlyContributions = (data || []) as { amount: number }[];
  const monthlyTotal = monthlyContributions.reduce(
    (sum, c) => sum + Number(c.amount),
    0
  );

  // Get new members this month
  const { count: newMembersThisMonth } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  return {
    totalMembers: totalMembers || 0,
    activeMembers: activeMembers || 0,
    totalChapters: totalChapters || 0,
    upcomingEvents: upcomingEvents || 0,
    monthlyContributions: monthlyTotal,
    newMembersThisMonth: newMembersThisMonth || 0,
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

async function getRecentActivity() {
  const supabase = createServerClient();

  // Recent members
  const { data: memberData } = await supabase
    .from('rlc_members')
    .select('id, first_name, last_name, email, created_at, membership_tier')
    .order('created_at', { ascending: false })
    .limit(5);

  // Recent contributions
  const { data: contributionData } = await supabase
    .from('rlc_contributions')
    .select(`
      id, amount, contribution_type, payment_status, created_at,
      member:rlc_members(first_name, last_name)
    `)
    .eq('payment_status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    recentMembers: (memberData || []) as RecentMember[],
    recentContributions: (contributionData || []) as RecentContribution[],
  };
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const activity = await getRecentActivity();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Overview of your RLC organization.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold">{stats.totalMembers.toLocaleString()}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rlc-red/10">
              <Users className="h-6 w-6 text-rlc-red" />
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {stats.activeMembers.toLocaleString()} active
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Chapters</p>
              <p className="text-2xl font-bold">{stats.totalChapters}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rlc-blue/10">
              <MapPin className="h-6 w-6 text-rlc-blue" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming Events</p>
              <p className="text-2xl font-bold">{stats.upcomingEvents}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rlc-gold/10">
              <Calendar className="h-6 w-6 text-rlc-gold" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.monthlyContributions)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-sm text-green-600">
            <TrendingUp className="h-4 w-4" />
            {stats.newMembersThisMonth} new members
          </p>
        </div>
      </div>

      {/* Activity Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Members */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Recent Members</h2>
            <Link href="/admin/members" className="text-sm text-rlc-red hover:underline">
              View all
            </Link>
          </div>
          <div className="p-4">
            {activity.recentMembers.length > 0 ? (
              <ul className="space-y-3">
                {activity.recentMembers.map((member) => (
                  <li key={member.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                      {member.membership_tier}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-muted-foreground">No recent members</p>
            )}
          </div>
        </div>

        {/* Recent Contributions */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Recent Contributions</h2>
            <Link href="/admin/contributions" className="text-sm text-rlc-red hover:underline">
              View all
            </Link>
          </div>
          <div className="p-4">
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
                        {contribution.contribution_type.replace('_', ' ')}
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
          </div>
        </div>
      </div>
    </div>
  );
}
