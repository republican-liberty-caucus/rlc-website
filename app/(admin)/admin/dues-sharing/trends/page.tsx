'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

interface TrendData {
  month: string;
  transferred: number;
  pending: number;
  count: number;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrends();
  }, []);

  async function fetchTrends() {
    try {
      const res = await fetch('/api/v1/admin/dues-sharing/trends?months=12');
      const data = await res.json();
      setTrends(data.trends || []);
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  const maxTransferred = Math.max(...trends.map((t) => t.transferred), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues Sharing Trends"
        description="Monthly distribution trends over the last 12 months"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded bg-muted" />
              ))}
            </div>
          ) : trends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available yet.</p>
          ) : (
            <div className="space-y-3">
              {trends.map((trend) => (
                <div key={trend.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {new Date(trend.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{formatCurrency(trend.transferred)}</Badge>
                      {trend.pending > 0 && (
                        <Badge variant="secondary">{formatCurrency(trend.pending)} pending</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{trend.count} entries</span>
                    </div>
                  </div>
                  {/* Simple bar chart */}
                  <div className="flex gap-1">
                    <div
                      className="h-3 rounded bg-primary transition-all"
                      style={{ width: `${(trend.transferred / maxTransferred) * 100}%`, minWidth: trend.transferred > 0 ? '4px' : '0' }}
                    />
                    {trend.pending > 0 && (
                      <div
                        className="h-3 rounded bg-muted-foreground/30"
                        style={{ width: `${(trend.pending / maxTransferred) * 100}%`, minWidth: '4px' }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
