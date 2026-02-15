import { Card, CardContent } from '@/components/ui/card';

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
  expiring: 'bg-orange-500',
  grace: 'bg-yellow-500',
  expired: 'bg-red-500',
  cancelled: 'bg-gray-400',
  deceased: 'bg-gray-300',
  pending: 'bg-yellow-400',
};

interface TierStatusCardsProps {
  membersByTier: Record<string, number>;
  totalMembers: number;
  membersByStatus: Record<string, number>;
}

export function TierStatusCards({
  membersByTier,
  totalMembers,
  membersByStatus,
}: TierStatusCardsProps) {
  const totalAllStatuses = Object.values(membersByStatus).reduce((a, b) => a + b, 0);
  return (
    <>
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
                    <span className="font-medium">
                      {count}{' '}
                      <span className="text-muted-foreground">({Math.round(pct)}%)</span>
                    </span>
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

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold">Members by Status</h2>
          <div className="space-y-3">
            {Object.entries(STATUS_LABELS).map(([key, label]) => {
              const count = membersByStatus[key] || 0;
              const pct = totalAllStatuses > 0 ? (count / totalAllStatuses) * 100 : 0;
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
    </>
  );
}
