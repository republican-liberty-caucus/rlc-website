'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';

interface MemberContribution {
  id: string;
  amount: number;
  created_at: string;
  rlc_members: {
    first_name: string;
    last_name: string;
    email: string;
  };
  splits: {
    recipient_chapter_id: string;
    amount: number;
    status: string;
  }[];
}

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MemberDuesPage() {
  const [data, setData] = useState<MemberContribution[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, [page]);

  async function fetchMembers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/dues-sharing/members?page=${page}&limit=20`);
      const json = await res.json();
      setData(json.data || []);
      setTotalPages(json.totalPages || 1);
    } catch {
      // Fetch failed
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member Dues Detail"
        description="Per-payment dues split breakdown"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Contributions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded bg-muted" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No membership contributions found.</p>
          ) : (
            <div className="space-y-3">
              {data.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {item.rlc_members.first_name} {item.rlc_members.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{item.rlc_members.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold">{formatCurrency(Number(item.amount))}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {item.splits.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.splits.map((split, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {formatCurrency(Number(split.amount))} - {split.status}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
