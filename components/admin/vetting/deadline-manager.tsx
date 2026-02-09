'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface Deadline {
  id: string;
  state_code: string;
  cycle_year: number;
  office_type: string;
  primary_date: string | null;
  primary_runoff_date: string | null;
  general_date: string | null;
  general_runoff_date: string | null;
  filing_deadline: string | null;
  notes: string | null;
  created_at: string;
}

interface DeadlineManagerProps {
  deadlines: Deadline[];
  canManage: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DeadlineManager({ deadlines, canManage }: DeadlineManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm('Delete this deadline?')) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/v1/admin/vetting/deadlines/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const stateCode = prompt('State code (e.g. MO):');
              if (!stateCode) return;
              const cycleYear = prompt('Cycle year (e.g. 2026):');
              if (!cycleYear) return;
              const officeType = prompt('Office type (e.g. US House):');
              if (!officeType) return;
              const primaryDate = prompt('Primary date (YYYY-MM-DD or leave empty):');
              const generalDate = prompt('General date (YYYY-MM-DD or leave empty):');

              const body: Record<string, unknown> = {
                stateCode: stateCode.toUpperCase(),
                cycleYear: parseInt(cycleYear, 10),
                officeType,
              };
              if (primaryDate) body.primaryDate = primaryDate;
              if (generalDate) body.generalDate = generalDate;

              const res = await fetch('/api/v1/admin/vetting/deadlines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (res.ok) {
                router.refresh();
              } else {
                const err = await res.json();
                alert(err.error || 'Failed to create deadline');
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Deadline
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">State</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Year</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Office</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Filing</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Primary</th>
                <th className="px-4 py-3 text-left text-sm font-medium">General</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                {canManage && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{d.state_code}</td>
                  <td className="px-4 py-3 text-sm">{d.cycle_year}</td>
                  <td className="px-4 py-3 text-sm">{d.office_type}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(d.filing_deadline)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(d.primary_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(d.general_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                    {d.notes || '-'}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        disabled={loading === d.id}
                        onClick={() => handleDelete(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {deadlines.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 8 : 7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No election deadlines yet. Add deadlines to track candidate timelines.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
