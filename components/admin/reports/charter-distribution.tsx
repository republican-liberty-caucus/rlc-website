import { Card, CardContent } from '@/components/ui/card';

interface CharterDistributionProps {
  membersByCharter: Record<string, { name: string; count: number }>;
}

export function CharterDistribution({ membersByCharter }: CharterDistributionProps) {
  const sorted = Object.values(membersByCharter).sort((a, b) => b.count - a.count);
  const topCount = sorted[0]?.count || 1;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold">Members by Charter</h2>
        {sorted.length > 0 ? (
          <div className="space-y-3">
            {sorted.map((ch) => {
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
        )}
      </CardContent>
    </Card>
  );
}
