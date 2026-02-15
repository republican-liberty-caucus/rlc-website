import { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { fetchReportData } from '@/lib/reports/fetch-report-data';
import { PageHeader } from '@/components/ui/page-header';
import { ReportFilters } from '@/components/admin/report-filters';
import { ReportKPIs } from '@/components/admin/reports/report-kpis';
import { StateDistribution } from '@/components/admin/reports/state-distribution';
import { AttentionNeeded } from '@/components/admin/reports/attention-needed';
import { TierStatusCards } from '@/components/admin/reports/tier-status-cards';
import { ContributionsTable } from '@/components/admin/reports/contributions-table';
import { CharterDistribution } from '@/components/admin/reports/charter-distribution';
import { ExpiringMembersTable } from '@/components/admin/reports/expiring-members-table';

export const metadata: Metadata = {
  title: 'Reports - Admin',
  description: 'Membership and contribution reports',
};

interface ReportsPageProps {
  searchParams: Promise<{ start?: string; end?: string; charter?: string }>;
}

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const { ctx } = await requireAdmin();
  const { start, end, charter: charterParam } = await searchParams;

  const data = await fetchReportData({ ctx, start, end, charterParam });

  return (
    <div>
      <PageHeader
        title={data.headerTitle}
        description={data.headerDescription}
        className="mb-8"
      />

      <ReportFilters
        charters={data.charterOptions.length > 1 ? data.charterOptions : undefined}
        isNational={data.isNational}
      />

      <ReportKPIs
        totalMembers={data.totalMembers}
        newMembersCurrent={data.newMembersCurrent}
        memberGrowth={data.memberGrowth}
        totalContributions={data.totalContributions}
        totalContribCount={data.totalContribCount}
        contribGrowth={data.contribGrowth}
        retentionRate={data.retentionRate}
        retainedCount={data.retainedCount}
        lapsedCount={data.lapsedCount}
        hasDateFilter={data.hasDateFilter}
      />

      {data.viewMode === 'multi_charter' && data.stateAggregates.length > 0 && (
        <StateDistribution
          stateAggregates={data.stateAggregates}
          totalMembers={data.totalMembers}
          stateAssignedTotal={data.stateAssignedTotal}
        />
      )}

      {data.viewMode === 'multi_charter' && (
        <AttentionNeeded
          decliningCharters={data.decliningCharters}
          zeroGrowthCharters={data.zeroGrowthCharters}
          totalExpiringCount={data.totalExpiringCount}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <TierStatusCards
          membersByTier={data.membersByTier}
          totalMembers={data.totalMembers}
          membersByStatus={data.membersByStatus}
          totalAllStatuses={data.totalAllStatuses}
        />

        <ContributionsTable contribByType={data.contribByType} />

        {data.viewMode === 'multi_charter' && (
          <CharterDistribution membersByCharter={data.membersByCharter} />
        )}

        {data.viewMode === 'single_charter' && (
          <ExpiringMembersTable members={data.expiringMembers} />
        )}
      </div>
    </div>
  );
}
