'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface PipelineRow {
  id: string;
  type: 'submission' | 'vetting';
  candidate_name: string;
  candidate_state: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  office_type: { name: string; district_label: string | null } | null;
  stage: string;
  total_score: number | null;
  recommendation: string | null;
  date: string;
  urgency: 'normal' | 'amber' | 'red';
  election_deadline: {
    primary_date: string | null;
    general_date: string | null;
  } | null;
}

interface PipelineTableProps {
  rows: PipelineRow[];
  canCreate: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatRecommendation(rec: string | null): string {
  if (!rec) return '-';
  return rec.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PipelineTable({ rows, canCreate }: PipelineTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [addingId, setAddingId] = useState<string | null>(null);

  async function handleAddToPipeline(candidateResponseId: string) {
    setAddingId(candidateResponseId);
    try {
      const res = await fetch('/api/v1/admin/vetting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateResponseId }),
        signal: AbortSignal.timeout(15000),
      });
      let data: { error?: string; vetting?: { candidate_name?: string } } | null = null;
      try {
        data = await res.json();
      } catch {
        // Response body is not JSON
      }
      if (!res.ok) {
        toast({ title: 'Error', description: data?.error || `Server returned ${res.status}`, variant: 'destructive' });
        return;
      }
      toast({ title: 'Added to Pipeline', description: `${data?.vetting?.candidate_name || 'Candidate'} is now in the vetting pipeline` });
      router.refresh();
    } catch (err) {
      console.error('Failed to add to pipeline:', err);
      const message = err instanceof Error ? err.message : 'Failed to add to pipeline';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">Candidate</th>
              <th className="px-4 py-3 text-left text-sm font-medium">State</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Office</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Recommendation</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSubmission = row.type === 'submission';
              const primaryDate = row.election_deadline?.primary_date ?? null;
              const days = daysUntil(primaryDate);

              return (
                <tr
                  key={`${row.type}-${row.id}`}
                  className={cn(
                    'border-b last:border-0',
                    isSubmission && 'bg-amber-50/50 dark:bg-amber-950/10',
                    !isSubmission && row.urgency === 'red' && 'bg-red-50 dark:bg-red-950/20',
                    !isSubmission && row.urgency === 'amber' && 'bg-amber-50 dark:bg-amber-950/20'
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium">{row.candidate_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.candidate_state || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.office_type?.name ?? row.candidate_office ?? '-'}
                    {row.candidate_district
                      ? ` (${row.office_type?.district_label ?? 'District'} ${row.candidate_district})`
                      : ''}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={row.stage} type="vetting" />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.total_score !== null ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          row.total_score >= 80
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : row.total_score >= 60
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        )}
                      >
                        {row.total_score}%
                      </span>
                    ) : days !== null ? (
                      <span
                        className={cn(
                          'text-xs font-medium',
                          days < 14 && 'text-red-600 dark:text-red-400',
                          days >= 14 && days < 30 && 'text-amber-600 dark:text-amber-400',
                          days >= 30 && 'text-muted-foreground'
                        )}
                      >
                        {days}d to primary
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {row.date ? formatDate(row.date) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatRecommendation(row.recommendation)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSubmission && canCreate ? (
                      <Button
                        size="sm"
                        onClick={() => handleAddToPipeline(row.id)}
                        disabled={addingId === row.id}
                        className="gap-1"
                        variant="outline"
                      >
                        <Play className="h-3 w-3" />
                        {addingId === row.id ? 'Adding...' : 'Add to Pipeline'}
                      </Button>
                    ) : isSubmission ? (
                      <span className="text-xs text-muted-foreground">Awaiting review</span>
                    ) : (
                      <Link href={`/admin/vetting/${row.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No candidates in the pipeline yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
