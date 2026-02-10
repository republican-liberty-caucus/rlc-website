import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatCurrency } from '@/lib/utils';
import {
  getDescendantIds,
  buildCharterOptions,
  computePreviousPeriod,
  computeGrowthPercent,
  aggregateByState,
} from '@/lib/admin/report-helpers';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserPlus, CreditCard, RefreshCw, AlertTriangle } from 'lucide-react';
import { ReportFilters } from '@/components/admin/report-filters';
import type { Charter } from '@/types';

export const metadata: Metadata = {
  title: 'Reports - Admin',
  description: 'Membership and contribution reports',
};

interface ReportsPageProps {
  searchParams: Promise<{ start?: string; end?: string; charter?: string }>;
}

function scopeByCharter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  charterIds: string[] | null,
  column: string = 'primary_charter_id'
): T {
  if (charterIds !== null && charterIds.length > 0) {
    return query.in(column, charterIds);
  }
  return query;
}

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { start, end, charter: charterParam } = await searchParams;
  const supabase = createServerClient();

  // Default to last 12 months
  const endDate = end ? new Date(end) : new Date();
  const startDate = start
    ? new Date(start)
    : new Date(new Date().setFullYear(endDate.getFullYear() - 1));

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  // Previous period for trend comparison
  const { prevStart, prevEnd } = computePreviousPeriod(startDate, endDate);
  const prevStartISO = prevStart.toISOString();
  const prevEndISO = prevEnd.toISOString();

  // --- Fetch all charters for dropdown + state grouping ---
  const { data: allChartersRaw } = await supabase
    .from('rlc_charters')
    .select('id, name, charter_level, parent_charter_id, state_code, status')
    .order('name');

  const allCharters = (allChartersRaw || []) as Pick<
    Charter,
    'id' | 'name' | 'charter_level' | 'parent_charter_id' | 'state_code' | 'status'
  >[];

  // --- Compute effective charter IDs (narrowed by charter param) ---
  let effectiveCharterIds = ctx.visibleCharterIds; // null = national sees all

  if (charterParam) {
    const descendants = getDescendantIds(charterParam, allCharters);
    if (ctx.visibleCharterIds === null) {
      // National user drilling into a charter
      effectiveCharterIds = descendants;
    } else {
      // Scoped user drilling into a charter — intersect with their visible set
      const visibleSet = new Set(ctx.visibleCharterIds);
      effectiveCharterIds = descendants.filter((id) => visibleSet.has(id));
    }
  }

  // --- Determine view mode ---
  type ViewMode = 'multi_charter' | 'single_charter';
  const viewMode: ViewMode =
    charterParam || (effectiveCharterIds?.length === 1)
      ? 'single_charter'
      : 'multi_charter';

  // --- Determine selected charter info for header ---
  const selectedCharter = charterParam
    ? allCharters.find((ch) => ch.id === charterParam)
    : null;

  // --- Parallel queries ---
  const [
    membersByTierResult,
    membersByStatusResult,
    membersByCharterResult,
    contributionsResult,
    newMembersResult,
    retentionResult,
    prevNewMembersResult,
    prevContributionsResult,
    expiringMembersResult,
    // Per-charter new members for current + previous period (multi-charter only)
    ...perCharterResults
  ] = await Promise.all([
    // 1. Members by tier
    scopeByCharter(
      supabase.from('rlc_members').select('membership_tier'),
      effectiveCharterIds
    ),
    // 2. Members by status
    scopeByCharter(
      supabase.from('rlc_members').select('membership_status'),
      effectiveCharterIds
    ),
    // 3. Members by charter
    (() => {
      let q = supabase.from('rlc_members')
        .select('primary_charter_id, charter:rlc_charters(name)')
        .not('primary_charter_id', 'is', null);
      if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
        q = q.in('primary_charter_id', effectiveCharterIds);
      }
      return q;
    })(),
    // 4. Contributions in date range
    (() => {
      let q = supabase.from('rlc_contributions')
        .select('amount, contribution_type, created_at, charter_id')
        .eq('payment_status', 'completed')
        .gte('created_at', startISO)
        .lte('created_at', endISO);
      if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
        q = q.in('charter_id', effectiveCharterIds);
      }
      return q;
    })(),
    // 5. New members count in date range
    scopeByCharter(
      supabase.from('rlc_members')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startISO)
        .lte('created_at', endISO),
      effectiveCharterIds
    ),
    // 6. Retention data
    scopeByCharter(
      supabase.from('rlc_members')
        .select('membership_status')
        .in('membership_status', ['current', 'expired', 'cancelled', 'grace']),
      effectiveCharterIds
    ),
    // 7 (8a). Previous-period new members count
    scopeByCharter(
      supabase.from('rlc_members')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevStartISO)
        .lte('created_at', prevEndISO),
      effectiveCharterIds
    ),
    // 8 (9). Previous-period contributions total
    (() => {
      let q = supabase.from('rlc_contributions')
        .select('amount')
        .eq('payment_status', 'completed')
        .gte('created_at', prevStartISO)
        .lte('created_at', prevEndISO);
      if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
        q = q.in('charter_id', effectiveCharterIds);
      }
      return q;
    })(),
    // 9 (10). Expiring members (next 30 days) — only for single-charter view
    ...(viewMode === 'single_charter'
      ? [
          (() => {
            const now = new Date();
            const in30Days = new Date();
            in30Days.setDate(in30Days.getDate() + 30);
            let q = supabase.from('rlc_members')
              .select('id, first_name, last_name, email, phone, membership_expiry_date')
              .in('membership_status', ['current', 'expiring'])
              .gte('membership_expiry_date', now.toISOString())
              .lte('membership_expiry_date', in30Days.toISOString())
              .order('membership_expiry_date', { ascending: true })
              .limit(20);
            if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
              q = q.in('primary_charter_id', effectiveCharterIds);
            }
            return q;
          })(),
        ]
      : [
          // Placeholder so destructuring works
          Promise.resolve({ data: null, count: null, error: null }),
        ]),
    // 10 (8b). Per-charter new members current period (multi-charter only)
    ...(viewMode === 'multi_charter'
      ? [
          // Current period per-charter
          (() => {
            let q = supabase.from('rlc_members')
              .select('primary_charter_id')
              .not('primary_charter_id', 'is', null)
              .gte('created_at', startISO)
              .lte('created_at', endISO);
            if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
              q = q.in('primary_charter_id', effectiveCharterIds);
            }
            return q;
          })(),
          // Previous period per-charter
          (() => {
            let q = supabase.from('rlc_members')
              .select('primary_charter_id')
              .not('primary_charter_id', 'is', null)
              .gte('created_at', prevStartISO)
              .lte('created_at', prevEndISO);
            if (effectiveCharterIds !== null && effectiveCharterIds.length > 0) {
              q = q.in('primary_charter_id', effectiveCharterIds);
            }
            return q;
          })(),
        ]
      : []),
  ]);

  // --- Process membership by tier ---
  const membersByTier: Record<string, number> = {};
  for (const row of (membersByTierResult.data || []) as { membership_tier: string }[]) {
    membersByTier[row.membership_tier] = (membersByTier[row.membership_tier] || 0) + 1;
  }

  // --- Process membership by status ---
  const membersByStatus: Record<string, number> = {};
  for (const row of (membersByStatusResult.data || []) as { membership_status: string }[]) {
    membersByStatus[row.membership_status] = (membersByStatus[row.membership_status] || 0) + 1;
  }

  // --- Process members by charter ---
  const membersByCharter: Record<string, { name: string; count: number }> = {};
  for (const row of (membersByCharterResult.data || []) as { primary_charter_id: string; charter: { name: string } | null }[]) {
    const chId = row.primary_charter_id;
    if (!membersByCharter[chId]) {
      membersByCharter[chId] = { name: row.charter?.name || 'Unknown', count: 0 };
    }
    membersByCharter[chId].count++;
  }

  // --- Process contributions ---
  const contributions = (contributionsResult.data || []) as {
    amount: number; contribution_type: string; created_at: string; charter_id: string | null;
  }[];
  const totalContributions = contributions.reduce((sum, c) => sum + Number(c.amount), 0);
  const contribByType: Record<string, { count: number; total: number }> = {};
  for (const c of contributions) {
    if (!contribByType[c.contribution_type]) {
      contribByType[c.contribution_type] = { count: 0, total: 0 };
    }
    contribByType[c.contribution_type].count++;
    contribByType[c.contribution_type].total += Number(c.amount);
  }

  // --- Process retention ---
  const retentionData = (retentionResult.data || []) as { membership_status: string }[];
  const retainedCount = retentionData.filter(r => r.membership_status === 'current' || r.membership_status === 'grace').length;
  const lapsedCount = retentionData.filter(r => r.membership_status === 'expired' || r.membership_status === 'cancelled').length;
  const retentionRate = retentionData.length > 0
    ? Math.round((retainedCount / retentionData.length) * 100)
    : 0;

  // --- Process previous-period data for trends ---
  const newMembersCurrent = newMembersResult.count || 0;
  const newMembersPrevious = prevNewMembersResult.count || 0;
  const memberGrowth = computeGrowthPercent(newMembersCurrent, newMembersPrevious);

  const prevContributions = (prevContributionsResult.data || []) as { amount: number }[];
  const prevContribTotal = prevContributions.reduce((sum, c) => sum + Number(c.amount), 0);
  const contribGrowth = computeGrowthPercent(totalContributions, prevContribTotal);

  // --- Process expiring members (single-charter view) ---
  const expiringMembers = (viewMode === 'single_charter'
    ? (expiringMembersResult?.data || []) as {
        id: string; first_name: string; last_name: string;
        email: string; phone: string | null; membership_expiry_date: string | null;
      }[]
    : []);

  // --- Process per-charter declining data (multi-charter view) ---
  let decliningCharters: { name: string; currentCount: number; prevCount: number }[] = [];
  let zeroGrowthCharters: string[] = [];
  let totalExpiringCount = 0;

  if (viewMode === 'multi_charter' && perCharterResults.length >= 2) {
    const [currentPerCharterResult, prevPerCharterResult] = perCharterResults;

    // Count per charter for current period
    const currentCounts: Record<string, number> = {};
    for (const row of ((currentPerCharterResult as { data: { primary_charter_id: string }[] | null }).data || []) as { primary_charter_id: string }[]) {
      currentCounts[row.primary_charter_id] = (currentCounts[row.primary_charter_id] || 0) + 1;
    }

    // Count per charter for previous period
    const prevCounts: Record<string, number> = {};
    for (const row of ((prevPerCharterResult as { data: { primary_charter_id: string }[] | null }).data || []) as { primary_charter_id: string }[]) {
      prevCounts[row.primary_charter_id] = (prevCounts[row.primary_charter_id] || 0) + 1;
    }

    // Find declining charters (had members before, fewer now)
    const allCharterIds = new Set([...Object.keys(currentCounts), ...Object.keys(prevCounts)]);
    for (const chId of allCharterIds) {
      const curr = currentCounts[chId] || 0;
      const prev = prevCounts[chId] || 0;
      const charterName = membersByCharter[chId]?.name || allCharters.find(c => c.id === chId)?.name || 'Unknown';

      if (prev > 0 && curr < prev) {
        decliningCharters.push({ name: charterName, currentCount: curr, prevCount: prev });
      }
      if (curr === 0 && prev === 0) {
        // Only count as zero-growth if charter has members total
        if (membersByCharter[chId]?.count) {
          zeroGrowthCharters.push(charterName);
        }
      } else if (curr === 0) {
        zeroGrowthCharters.push(charterName);
      }
    }
    decliningCharters.sort((a, b) => (b.prevCount - b.currentCount) - (a.prevCount - a.currentCount));

    // Expiring members count across all visible charters
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const { count: expiringCount } = await scopeByCharter(
      supabase.from('rlc_members')
        .select('*', { count: 'exact', head: true })
        .in('membership_status', ['current', 'expiring'])
        .gte('membership_expiry_date', now.toISOString())
        .lte('membership_expiry_date', in30Days.toISOString()),
      effectiveCharterIds
    );
    totalExpiringCount = expiringCount || 0;
  }

  // --- State aggregation (national multi-charter only) ---
  const memberCountByCharterId: Record<string, number> = {};
  for (const [chId, data] of Object.entries(membersByCharter)) {
    memberCountByCharterId[chId] = data.count;
  }
  const stateAggregates = ctx.isNational && viewMode === 'multi_charter'
    ? aggregateByState(memberCountByCharterId, allCharters)
    : [];

  // --- Build header ---
  const LEVEL_LABELS: Record<string, string> = {
    national: 'National',
    multi_state_region: 'Multi-State Region',
    state: 'State',
    intra_state_region: 'Intra-State Region',
    county: 'County',
  };

  let headerTitle: string;
  let headerDescription: string;

  if (selectedCharter) {
    headerTitle = `${selectedCharter.name} Report`;
    headerDescription = LEVEL_LABELS[selectedCharter.charter_level] || selectedCharter.charter_level;
  } else if (ctx.isNational) {
    headerTitle = 'National Membership Report';
    headerDescription = 'All charters';
  } else {
    // Scoped user — find their top-level charter for the label
    const topRole = ctx.roles.find(r => r.charter_id);
    const topCharter = topRole ? allCharters.find(c => c.id === topRole.charter_id) : null;
    if (topCharter) {
      headerTitle = `${topCharter.name} Report`;
      const childCount = effectiveCharterIds?.length || 0;
      headerDescription = childCount > 1
        ? `${childCount} charters in your ${LEVEL_LABELS[topCharter.charter_level]?.toLowerCase() || 'scope'}`
        : 'Your charter';
    } else {
      headerTitle = 'Reports';
      headerDescription = `${effectiveCharterIds?.length || 0} charters`;
    }
  }

  headerDescription += ` \u2014 ${startDate.toLocaleDateString()} \u2013 ${endDate.toLocaleDateString()}`;

  // --- Build charter dropdown options ---
  const charterOptions = buildCharterOptions(allCharters, ctx.visibleCharterIds);

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
        title={headerTitle}
        description={headerDescription}
        className="mb-8"
      />

      <ReportFilters
        charters={charterOptions.length > 1 ? charterOptions : undefined}
        isNational={ctx.isNational}
      />

      {/* Summary KPIs with trends */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Members"
          value={totalMembers.toLocaleString()}
          icon={<Users className="h-5 w-5 text-rlc-red" />}
        />
        <StatCard
          label="New Members"
          value={newMembersCurrent.toLocaleString()}
          icon={<UserPlus className="h-5 w-5 text-rlc-blue" />}
          trend={{
            value: `${memberGrowth.value}% vs prior period`,
            direction: memberGrowth.direction,
          }}
          description="in date range"
        />
        <StatCard
          label="Total Contributions"
          value={formatCurrency(totalContributions)}
          icon={<CreditCard className="h-5 w-5 text-green-600" />}
          trend={{
            value: `${contribGrowth.value}% vs prior period`,
            direction: contribGrowth.direction,
          }}
          description={`${contributions.length} payments`}
        />
        <StatCard
          label="Retention Rate"
          value={`${retentionRate}%`}
          icon={<RefreshCw className="h-5 w-5 text-purple-600" />}
          description={`${retainedCount} active / ${lapsedCount} lapsed`}
        />
      </div>

      {/* Multi-charter: Members by State (national only) */}
      {viewMode === 'multi_charter' && stateAggregates.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">Members by State</h2>
            <div className="space-y-3">
              {stateAggregates.map((s) => {
                const pct = (s.count / totalMembers) * 100;
                return (
                  <div key={s.stateCode}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{s.stateName} ({s.stateCode})</span>
                      <span className="font-medium">{s.count} <span className="text-muted-foreground">({Math.round(pct)}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-rlc-blue transition-all"
                        style={{ width: `${Math.max(pct, s.count > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-charter: Attention Needed */}
      {viewMode === 'multi_charter' && (decliningCharters.length > 0 || zeroGrowthCharters.length > 0 || totalExpiringCount > 0) && (
        <Card className="mb-6 border-orange-200 dark:border-orange-900">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h2 className="font-heading text-lg font-semibold">Attention Needed</h2>
            </div>
            <div className="space-y-3 text-sm">
              {decliningCharters.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-orange-700 dark:text-orange-300">
                    Declining Membership ({decliningCharters.length} charter{decliningCharters.length !== 1 ? 's' : ''})
                  </p>
                  <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                    {decliningCharters.slice(0, 5).map((ch) => (
                      <li key={ch.name}>
                        {ch.name}: {ch.currentCount} new (was {ch.prevCount} prior period)
                      </li>
                    ))}
                    {decliningCharters.length > 5 && (
                      <li>...and {decliningCharters.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {zeroGrowthCharters.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-orange-700 dark:text-orange-300">
                    No New Members This Period ({zeroGrowthCharters.length} charter{zeroGrowthCharters.length !== 1 ? 's' : ''})
                  </p>
                  <p className="text-muted-foreground">
                    {zeroGrowthCharters.slice(0, 5).join(', ')}
                    {zeroGrowthCharters.length > 5 && `, and ${zeroGrowthCharters.length - 5} more`}
                  </p>
                </div>
              )}
              {totalExpiringCount > 0 && (
                <div>
                  <p className="font-medium text-orange-700 dark:text-orange-300">
                    <Link
                      href="/admin/members?status=expiring"
                      className="hover:underline"
                    >
                      {totalExpiringCount} member{totalExpiringCount !== 1 ? 's' : ''} expiring in the next 30 days &rarr;
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

        {/* Members by Charter (multi-charter view) */}
        {viewMode === 'multi_charter' && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 font-heading text-lg font-semibold">Members by Charter</h2>
              {(() => {
                const sortedCharters = Object.values(membersByCharter).sort((a, b) => b.count - a.count);
                const topCount = sortedCharters[0]?.count || 1;
                return sortedCharters.length > 0 ? (
                  <div className="space-y-3">
                    {sortedCharters.map((ch) => {
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
        )}

        {/* Single-charter: Expiring Members (actionable list) */}
        {viewMode === 'single_charter' && expiringMembers.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold">Expiring Members (Next 30 Days)</h2>
                <Link
                  href="/admin/members?status=expiring"
                  className="text-sm font-medium text-rlc-red hover:underline"
                >
                  View all {expiringMembers.length === 20 ? '20+' : expiringMembers.length} &rarr;
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left text-sm font-medium">Name</th>
                      <th className="py-2 text-left text-sm font-medium">Email</th>
                      <th className="py-2 text-left text-sm font-medium">Phone</th>
                      <th className="py-2 text-right text-sm font-medium">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringMembers.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 text-sm">
                          <Link
                            href={`/admin/members/${m.id}`}
                            className="font-medium text-rlc-blue hover:underline"
                          >
                            {m.first_name} {m.last_name}
                          </Link>
                        </td>
                        <td className="py-2 text-sm text-muted-foreground">
                          {m.email}
                        </td>
                        <td className="py-2 text-sm text-muted-foreground">
                          {m.phone || '\u2014'}
                        </td>
                        <td className="py-2 text-right text-sm">
                          {m.membership_expiry_date
                            ? new Date(m.membership_expiry_date).toLocaleDateString()
                            : '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
