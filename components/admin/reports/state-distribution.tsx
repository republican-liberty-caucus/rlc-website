import { Card, CardContent } from '@/components/ui/card';
import type { StateAggregate } from '@/lib/admin/report-helpers';

interface StateDistributionProps {
  stateAggregates: StateAggregate[];
  totalMembers: number;
  stateAssignedTotal: number;
}

export function StateDistribution({
  stateAggregates,
  totalMembers,
  stateAssignedTotal,
}: StateDistributionProps) {
  const unassignedCount = totalMembers - stateAssignedTotal;

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold">Members by State</h2>
        <div className="space-y-3">
          {stateAggregates.map((s) => {
            const pct = totalMembers > 0 ? (s.count / totalMembers) * 100 : 0;
            return (
              <div key={s.stateCode}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>
                    {s.stateName} ({s.stateCode})
                  </span>
                  <span className="font-medium">
                    {s.count}{' '}
                    <span className="text-muted-foreground">({Math.round(pct)}%)</span>
                  </span>
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
          {unassignedCount > 0 &&
            (() => {
              const pct = totalMembers > 0 ? (unassignedCount / totalMembers) * 100 : 0;
              return (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">No Charter Assigned</span>
                    <span className="font-medium">
                      {unassignedCount}{' '}
                      <span className="text-muted-foreground">({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-muted-foreground/30 transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })()}
        </div>
      </CardContent>
    </Card>
  );
}
