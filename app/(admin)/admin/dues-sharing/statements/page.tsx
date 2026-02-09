'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileText } from 'lucide-react';

interface StatementEntry {
  id: string;
  contribution_id: string;
  source_type: string;
  recipient_charter_id: string;
  amount: number;
  status: string;
  transferred_at: string | null;
  created_at: string;
}

interface StatementSummary {
  totalTransferred: number;
  totalPending: number;
  totalReversed: number;
  entryCount: number;
}

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  transferred: 'default',
  pending: 'secondary',
  reversed: 'destructive',
  failed: 'destructive',
};

export default function StatementsPage() {
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatements();
  }, [month]);

  async function fetchStatements() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/dues-sharing/statements?month=${month}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setSummary(data.summary || null);
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  function handleExportCsv() {
    window.open(`/api/v1/admin/dues-sharing/statements?month=${month}&format=csv`, '_blank');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Statements"
        description="View and export dues distribution statements"
      />

      {/* Controls */}
      <div className="flex items-end gap-4">
        <div>
          <Label>Month</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button variant="outline" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Transferred</p>
              <p className="text-xl font-bold">{formatCurrency(summary.totalTransferred)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-xl font-bold">{formatCurrency(summary.totalPending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Reversed</p>
              <p className="text-xl font-bold">{formatCurrency(summary.totalReversed)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Entries</p>
              <p className="text-xl font-bold">{summary.entryCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ledger Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded bg-muted" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Date</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2">{new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="p-2 font-mono">
                        {Number(entry.amount) < 0 ? '-' : ''}{formatCurrency(Number(entry.amount))}
                      </td>
                      <td className="p-2">
                        <Badge variant={statusColors[entry.status] || 'secondary'}>
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="p-2">{entry.source_type}</td>
                      <td className="p-2 font-mono text-xs">{entry.contribution_id.slice(0, 8)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
