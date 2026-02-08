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

  // Parallel queries for all report data
  const [
    membersByTierResult,
    membersByStatusResult,
    membersByChapterResult,
    contributionsResult,
    newMembersResult,
    retentionResult,
  ] = await Promise.all([
    // Members by tier (current snapshot)
    scopeByChapter(
      supabase.from('rlc_members').select('membership_tier'),
      ctx.visibleChapterIds
    ),
    // Members by status (current snapshot)
    scopeByChapter(
      supabase.from('rlc_members').select('membership_status'),
      ctx.visibleChapterIds
    ),
    // Members by chapter
    ctx.isNational
      ? supabase.from('rlc_members')
          .select('primary_chapter_id, chapter:rlc_chapters(name)')
          .not('primary_chapter_id', 'is', null)
      : (ctx.visibleChapterIds && ctx.visibleChapterIds.length > 0
        ? supabase.from('rlc_members')
            .select('primary_chapter_id, chapter:rlc_chapters(name)')
            .in('primary_chapter_id', ctx.visibleChapterIds)
        : supabase.from('rlc_members')
            .select('primary_chapter_id, chapter:rlc_chapters(name)')
            .not('primary_chapter_id', 'is', null)),
    // Contributions in date range
    (() => {
      let q = supabase.from('rlc_contributions')
        .select('amount, contribution_type, created_at, chapter_id')
        .eq('payment_status', 'completed')
        .gte('created_at', startISO)
        .lte('created_at', endISO);
      if (ctx.visibleChapterIds !== null && ctx.visibleChapterIds.length > 0) {
        q = q.in('chapter_id', ctx.visibleChapterIds);
      }
      return q;
    })(),
    // New members in date range
    scopeByChapter(
      supabase.from('rlc_members')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startISO)
        .lte('created_at', endISO),
      ctx.visibleChapterIds
    ),
    // Retention: current vs expired/cancelled
    scopeByChapter(
      supabase.from('rlc_members')
        .select('membership_status')
        .in('membership_status', ['current', 'expired', 'cancelled', 'grace']),
      ctx.visibleChapterIds
    ),
  ]);

  // Process membership by tier
  const membersByTier: Record<string, number> = {};
  for (const row of (membersByTierResult.data || []) as { membership_tier: string }[]) {
    membersByTier[row.membership_tier] = (membersByTier[row.membership_tier] || 0) + 1;
  }

  // Process membership by status
  const membersByStatus: Record<string, number> = {};
  for (const row of (membersByStatusResult.data || []) as { membership_status: string }[]) {
    membersByStatus[row.membership_status] = (membersByStatus[row.membership_status] || 0) + 1;
  }

  // Process members by chapter
  const membersByChapter: Record<string, { name: string; count: number }> = {};
  for (const row of (membersByChapterResult.data || []) as { primary_chapter_id: string; chapter: { name: string } | null }[]) {
    const chId = row.primary_chapter_id;
    if (!membersByChapter[chId]) {
      membersByChapter[chId] = { name: row.chapter?.name || 'Unknown', count: 0 };
    }
    membersByChapter[chId].count++;
  }

  // Process contributions
  const contributions = (contributionsResult.data || []) as {
    amount: number; contribution_type: string; created_at: string; chapter_id: string | null;
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

  // Process retention
  const retentionData = (retentionResult.data || []) as { membership_status: string }[];
  const retainedCount = retentionData.filter(r => r.membership_status === 'current' || r.membership_status === 'grace').length;
  const lapsedCount = retentionData.filter(r => r.membership_status === 'expired' || r.membership_status === 'cancelled').length;
  const retentionRate = retentionData.length > 0
    ? Math.round((retainedCount / retentionData.length) * 100)
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
        description={`${startDate.toLocaleDateString()} \u2014 ${endDate.toLocaleDateString()}${ctx.isNational ? ' (National)' : ` (${ctx.visibleChapterIds?.length || 0} chapters)`}`}
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
          description={`${contributions.length} payments`}
        />
        <StatCard
          label="Retention Rate"
          value={`${retentionRate}%`}
          icon={<RefreshCw className="h-5 w-5 text-purple-600" />}
          description={`${retainedCount} active / ${lapsedCount} lapsed`}
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

        {/* Members by Chapter */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">Members by Chapter</h2>
            {(() => {
              const sortedChapters = Object.values(membersByChapter).sort((a, b) => b.count - a.count);
              const topCount = sortedChapters[0]?.count || 1;
              return sortedChapters.length > 0 ? (
                <div className="space-y-3">
                  {sortedChapters.map((ch) => {
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
                  No chapter data available
                </p>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
