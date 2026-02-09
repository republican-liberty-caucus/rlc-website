'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

interface VettingItem {
  id: string;
  candidate_name: string;
  candidate_state: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  stage: string;
  recommendation: string | null;
  created_at: string;
  urgency: 'normal' | 'amber' | 'red';
  election_deadline: {
    primary_date: string | null;
    general_date: string | null;
  } | null;
}

interface PipelineTableProps {
  vettings: VettingItem[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatRecommendation(rec: string | null): string {
  if (!rec) return '-';
  return rec.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PipelineTable({ vettings }: PipelineTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">Candidate</th>
              <th className="px-4 py-3 text-left text-sm font-medium">State</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Office</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Stage</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Primary</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Days</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Recommendation</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vettings.map((v) => {
              const primaryDate = v.election_deadline?.primary_date ?? null;
              const days = daysUntil(primaryDate);

              return (
                <tr
                  key={v.id}
                  className={cn(
                    'border-b last:border-0',
                    v.urgency === 'red' && 'bg-red-50 dark:bg-red-950/20',
                    v.urgency === 'amber' && 'bg-amber-50 dark:bg-amber-950/20'
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium">{v.candidate_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {v.candidate_state || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {v.candidate_office || '-'}
                    {v.candidate_district ? ` (${v.candidate_district})` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={v.stage} type="vetting" />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {primaryDate ? formatDate(primaryDate) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {days !== null ? (
                      <span
                        className={cn(
                          'font-medium',
                          days < 14 && 'text-red-600 dark:text-red-400',
                          days >= 14 && days < 30 && 'text-amber-600 dark:text-amber-400',
                          days >= 30 && 'text-muted-foreground'
                        )}
                      >
                        {days}d
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatRecommendation(v.recommendation)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/vetting/${v.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
            {vettings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No candidates in the vetting pipeline yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
