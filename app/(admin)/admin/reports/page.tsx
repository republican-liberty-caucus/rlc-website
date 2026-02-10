import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserPlus, CreditCard, RefreshCw } from 'lucide-react';
import { ReportFilters } from '@/components/admin/report-filters';

export const metadata: Metadata = {
  title: 'Reports - Admin',
  description: 'Membership and contribution reports',
};

interface ReportsPageProps {
  searchParams: Promise<{ start?: string; end?: string }>;
}

interface TierCount { membership_tier: string; count: number }
interface StatusCount { membership_status: string; count: number }
interface CharterCount { charter_id: string; charter_name: string; count: number }
interface ContribSummary { contribution_type: string; count: number; total_amount: number }

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { start, end } = await searchParams;
  const supabase = createServerClient();

  // Default to last 12 months
  const endDate = end ? new Date(end) : new Date();
  const startDate = start
    ? new Date(start)
    : new Date(new Date().setFullYear(endDate.getFullYear() - 1));

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  // Charter scoping: null = national (no filter), string[] = scoped admin
  const charterIds = ctx.visibleCharterIds;

  // Server-side aggregation via PostgreSQL RPC functions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Database type lacks Relationships on tables, so Schema resolves to never for .rpc()
  const rpc = supabase.rpc.bind(supabase) as (fn: string, args?: Record<string, unknown>) => any;
  const [tierResult, statusResult, charterResult, contribResult, newMembersResult] = await Promise.all([
    rpc('get_members_by_tier', { p_charter_ids: charterIds }),
    rpc('get_members_by_status', { p_charter_ids: charterIds }),
    rpc('get_members_by_charter', { p_charter_ids: charterIds }),
    rpc('get_contribution_summary', {
      p_start_date: startISO,
      p_end_date: endISO,
      p_charter_ids: charterIds,
    }),
    // New member count — already correct (uses count header, not row fetching)
    (() => {
      let q = supabase.from('rlc_members')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startISO)
        .lte('created_at', endISO);
      if (charterIds !== null && charterIds.length > 0) {
        q = q.in('primary_charter_id', charterIds);
      }
      return q;
    })(),
  ]);

  // Process RPC results into display-ready data
  const tierData = (tierResult.data || []) as TierCount[];
  const membersByTier: Record<string, number> = {};
  for (const row of tierData) {
    membersByTier[row.membership_tier] = Number(row.count);
  }

  const statusData = (statusResult.data || []) as StatusCount[];
  const membersByStatus: Record<string, number> = {};
  for (const row of statusData) {
    membersByStatus[row.membership_status] = Number(row.count);
  }

  const charterData = (charterResult.data || []) as CharterCount[];
  const membersByCharter = charterData.map(row => ({
    name: row.charter_name,
    count: Number(row.count),
  }));

  const contribData = (contribResult.data || []) as ContribSummary[];
  const totalContributions = contribData.reduce((sum, c) => sum + Number(c.total_amount), 0);
  const contribByType: Record<string, { count: number; total: number }> = {};
  for (const c of contribData) {
    contribByType[c.contribution_type] = { count: Number(c.count), total: Number(c.total_amount) };
  }
  const totalContribCount = contribData.reduce((sum, c) => sum + Number(c.count), 0);

  // Retention: derived from status counts (no separate query needed)
  const retainedCount = (membersByStatus['current'] || 0) + (membersByStatus['grace'] || 0);
  const lapsedCount = (membersByStatus['expired'] || 0) + (membersByStatus['cancelled'] || 0);
  const retentionDenom = retainedCount + lapsedCount;
  const retentionRate = retentionDenom > 0
    ? Math.round((retainedCount / retentionDenom) * 100)
    : 0;

  const TIER_LABELS: Record<string, string> = {
    student_military: 'Student/Military',
    individual: 'Individual',
    premium: 'Premium',
    sustaining: 'Sustaining',
    patron: 'Patron',
    benefactor: 'Benefactor',
    roundtable: 'Roundtable',
  };

  const totalMembers = Object.values(membersByTier).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`${startDate.toLocaleDateString()} \u2014 ${endDate.toLocaleDateString()}${ctx.isNational ? ' (National)' : ` (${ctx.visibleCharterIds?.length || 0} charters)`}`}
        className="mb-8"
      />

      <ReportFilters />

      {/* Summary KPIs */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={totalMembers.toLocaleString()}
          icon={<Users className="h-5 w-5 text-rlc-red" />}
        />
        <StatCard
          label="New Members"
          value={(newMembersResult.count || 0).toLocaleString()}
          icon={<UserPlus className="h-5 w-5 text-rlc-blue" />}
          description="in date range"
        />
        <StatCard
          label="Total Contributions"
          value={formatCurrency(totalContributions)}
          icon={<CreditCard className="h-5 w-5 text-green-600" />}
          description={`${totalContribCount.toLocaleString()} payments`}
        />
        <StatCard
          label="Retention Rate"
          value={`${retentionRate}%`}
          icon={<RefreshCw className="h-5 w-5 text-purple-600" />}
          description={`${retainedCount.toLocaleString()} active / ${lapsedCount.toLocaleString()} lapsed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Members by Tier */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">Members by Tier</h2>
            <div className="space-y-3">
              {Object.entries(TIER_LABELS).map(([key, label]) => {
                const count = membersByTier[key] || 0;
                const pct = totalMembers > 0 ? (count / totalMembers) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{label}</span>
                      <span className="font-medium">{count} <span className="text-muted-foreground">({Math.round(pct)}%)</span></span>
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
            <h2 className="mb-4 font-heading text-lg font-semibold">Members by Status</h2>
            <div className="space-y-3">
              {Object.entries(membersByStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const pct = totalMembers > 0 ? (count / totalMembers) * 100 : 0;
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <StatusBadge status={status} type="membership" />
                        <span className="font-medium">{count} <span className="text-muted-foreground">({Math.round(pct)}%)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-rlc-blue transition-all"
                          style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Contributions by Type */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">Contributions by Type</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left text-sm font-medium">Type</th>
                  <th className="py-2 text-right text-sm font-medium">Count</th>
                  <th className="py-2 text-right text-sm font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(contribByType)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([type, data]) => (
                    <tr key={type} className="border-b last:border-0">
                      <td className="py-2 text-sm capitalize">{type.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right text-sm">{data.count}</td>
                      <td className="py-2 text-right text-sm font-medium">{formatCurrency(data.total)}</td>
                    </tr>
                  ))}
                {Object.keys(contribByType).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-sm text-muted-foreground">
                      No contributions in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Members by Charter */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">Members by Charter</h2>
            {(() => {
              const topCount = membersByCharter[0]?.count || 1;
              return membersByCharter.length > 0 ? (
                <div className="space-y-3">
                  {membersByCharter.map((ch) => {
                    const pct = (ch.count / topCount) * 100;
                    return (
                      <div key={ch.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>{ch.name}</span>
                          <span className="font-medium">{ch.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-rlc-red/70 transition-all"
                            style={{ width: `${Math.max(pct, ch.count > 0 ? 2 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No charter data available
                </p>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
