import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/ui/stat-card';
import { Users, UserPlus, CreditCard, RefreshCw } from 'lucide-react';
import type { GrowthDirection } from '@/lib/admin/report-helpers';

interface ReportKPIsProps {
  totalMembers: number;
  newMembersCurrent: number;
  memberGrowth: { value: number; direction: GrowthDirection };
  totalContributions: number;
  totalContribCount: number;
  contribGrowth: { value: number; direction: GrowthDirection };
  retentionRate: number;
  retainedCount: number;
  lapsedCount: number;
  hasDateFilter: boolean;
}

export function ReportKPIs({
  totalMembers,
  newMembersCurrent,
  memberGrowth,
  totalContributions,
  totalContribCount,
  contribGrowth,
  retentionRate,
  retainedCount,
  lapsedCount,
  hasDateFilter,
}: ReportKPIsProps) {
  return (
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
        trend={
          hasDateFilter
            ? { value: `${memberGrowth.value}% vs prior period`, direction: memberGrowth.direction }
            : undefined
        }
        description="in date range"
      />
      <StatCard
        label="Total Contributions"
        value={formatCurrency(totalContributions)}
        icon={<CreditCard className="h-5 w-5 text-green-600" />}
        trend={
          hasDateFilter
            ? { value: `${contribGrowth.value}% vs prior period`, direction: contribGrowth.direction }
            : undefined
        }
        description={`${totalContribCount} payments`}
      />
      <StatCard
        label="Retention Rate"
        value={`${retentionRate}%`}
        icon={<RefreshCw className="h-5 w-5 text-purple-600" />}
        description={`${retainedCount} active / ${lapsedCount} lapsed`}
      />
    </div>
  );
}
