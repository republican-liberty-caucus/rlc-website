import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface ContributionsTableProps {
  contribByType: Record<string, { count: number; total: number }>;
}

export function ContributionsTable({ contribByType }: ContributionsTableProps) {
  const sorted = Object.entries(contribByType).sort(([, a], [, b]) => b.total - a.total);

  return (
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
            {sorted.map(([type, data]) => (
              <tr key={type} className="border-b last:border-0">
                <td className="py-2 text-sm capitalize">{type.replace(/_/g, ' ')}</td>
                <td className="py-2 text-right text-sm">{data.count}</td>
                <td className="py-2 text-right text-sm font-medium">
                  {formatCurrency(data.total)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
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
  );
}
