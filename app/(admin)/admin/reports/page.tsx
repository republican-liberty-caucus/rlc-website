import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatCurrency } from '@/lib/utils';
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="mt-2 text-muted-foreground">
          {startDate.toLocaleDateString()} &mdash; {endDate.toLocaleDateString()}
          {ctx.isNational ? ' (National)' : ` (${ctx.visibleChapterIds?.length || 0} chapters)`}
        </p>
      </div>

      <ReportFilters />

      {/* Summary KPIs */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Members</p>
          <p className="text-2xl font-bold">{totalMembers.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">New Members</p>
          <p className="text-2xl font-bold">{(newMembersResult.count || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">in date range</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Contributions</p>
          <p className="text-2xl font-bold">{formatCurrency(totalContributions)}</p>
          <p className="text-xs text-muted-foreground">{contributions.length} payments</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Retention Rate</p>
          <p className="text-2xl font-bold">{retentionRate}%</p>
          <p className="text-xs text-muted-foreground">
            {retainedCount} active / {lapsedCount} lapsed
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Members by Tier */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Members by Tier</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left text-sm font-medium">Tier</th>
                <th className="py-2 text-right text-sm font-medium">Count</th>
                <th className="py-2 text-right text-sm font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(TIER_LABELS).map(([key, label]) => {
                const count = membersByTier[key] || 0;
                return (
                  <tr key={key} className="border-b last:border-0">
                    <td className="py-2 text-sm">{label}</td>
                    <td className="py-2 text-right text-sm font-medium">{count}</td>
                    <td className="py-2 text-right text-sm text-muted-foreground">
                      {totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Members by Status */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Members by Status</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left text-sm font-medium">Status</th>
                <th className="py-2 text-right text-sm font-medium">Count</th>
                <th className="py-2 text-right text-sm font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(membersByStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <tr key={status} className="border-b last:border-0">
                    <td className="py-2 text-sm capitalize">{status.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-right text-sm font-medium">{count}</td>
                    <td className="py-2 text-right text-sm text-muted-foreground">
                      {totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Contributions by Type */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Contributions by Type</h2>
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
        </div>

        {/* Members by Chapter */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Members by Chapter</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left text-sm font-medium">Chapter</th>
                <th className="py-2 text-right text-sm font-medium">Members</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(membersByChapter)
                .sort((a, b) => b.count - a.count)
                .map((ch) => (
                  <tr key={ch.name} className="border-b last:border-0">
                    <td className="py-2 text-sm">{ch.name}</td>
                    <td className="py-2 text-right text-sm font-medium">{ch.count}</td>
                  </tr>
                ))}
              {Object.keys(membersByChapter).length === 0 && (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-sm text-muted-foreground">
                    No chapter data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
