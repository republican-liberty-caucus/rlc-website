'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditEntry {
  id: string;
  contribution_id: string;
  source_type: string;
  recipient_charter_id: string;
  charter_name: string;
  amount: number;
  currency: string;
  status: string;
  stripe_transfer_id: string | null;
  stripe_transfer_group_id: string | null;
  transferred_at: string | null;
  reversal_of_id: string | null;
  split_rule_snapshot: Record<string, unknown>;
  created_at: string;
}

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  transferred: 'default',
  pending: 'secondary',
  reversed: 'destructive',
  failed: 'destructive',
};

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudit();
  }, [page, statusFilter]);

  async function fetchAudit() {
    setLoading(true);
    try {
      let url = `/api/v1/admin/dues-sharing/audit?page=${page}&limit=50`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setEntries(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Complete ledger history for all dues distributions"
      />

      {/* Filters */}
      <div className="flex items-end gap-4">
        <div>
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="mt-1 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="transferred">Transferred</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary">{total} total entries</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Ledger Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded bg-muted" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Date</th>
                    <th className="p-2">Charter</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Transfer ID</th>
                    <th className="p-2">Reversal</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="whitespace-nowrap p-2">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="p-2">{entry.charter_name}</td>
                      <td className="p-2 font-mono">
                        {formatCurrency(Number(entry.amount))}
                      </td>
                      <td className="p-2">
                        <Badge variant={statusColors[entry.status] || 'secondary'}>
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="p-2">{entry.source_type}</td>
                      <td className="p-2 font-mono text-xs">
                        {entry.stripe_transfer_id ? `${entry.stripe_transfer_id.slice(0, 12)}...` : '-'}
                      </td>
                      <td className="p-2 text-xs">
                        {entry.reversal_of_id ? 'Reversal' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
