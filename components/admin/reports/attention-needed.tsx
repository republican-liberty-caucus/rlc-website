import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { DecliningCharter } from '@/lib/reports/fetch-report-data';

interface AttentionNeededProps {
  decliningCharters: DecliningCharter[];
  zeroGrowthCharters: string[];
  totalExpiringCount: number;
}

export function AttentionNeeded({
  decliningCharters,
  zeroGrowthCharters,
  totalExpiringCount,
}: AttentionNeededProps) {
  if (decliningCharters.length === 0 && zeroGrowthCharters.length === 0 && totalExpiringCount === 0) {
    return null;
  }

  return (
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
                Declining Membership ({decliningCharters.length} charter
                {decliningCharters.length !== 1 ? 's' : ''})
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
                No New Members This Period ({zeroGrowthCharters.length} charter
                {zeroGrowthCharters.length !== 1 ? 's' : ''})
              </p>
              <p className="text-muted-foreground">
                {zeroGrowthCharters.slice(0, 5).join(', ')}
                {zeroGrowthCharters.length > 5 &&
                  `, and ${zeroGrowthCharters.length - 5} more`}
              </p>
            </div>
          )}
          {totalExpiringCount > 0 && (
            <div>
              <p className="font-medium text-orange-700 dark:text-orange-300">
                <Link href="/admin/members?status=expiring" className="hover:underline">
                  {totalExpiringCount} member{totalExpiringCount !== 1 ? 's' : ''} expiring in
                  the next 30 days &rarr;
                </Link>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
