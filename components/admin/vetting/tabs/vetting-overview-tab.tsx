'use client';

import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_ORDER, calculateUrgency } from '@/lib/vetting/engine';
import type { VettingFullData } from '../types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface VettingOverviewTabProps {
  vetting: VettingFullData;
}

export function VettingOverviewTab({ vetting }: VettingOverviewTabProps) {
  const stageIndex = STAGE_ORDER.indexOf(vetting.stage);
  const urgency = calculateUrgency(vetting.election_deadline?.primary_date ?? null);

  return (
    <div className="space-y-6">
      {/* Candidate info card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{vetting.candidate_name}</h2>
            <p className="text-sm text-muted-foreground">
              {[
                vetting.candidate_party,
                vetting.office_type?.name ?? vetting.candidate_office,
                vetting.candidate_district
                  ? `${vetting.office_type?.district_label ?? 'District'} ${vetting.candidate_district}`
                  : null,
              ]
                .filter(Boolean)
                .join(' \u2022 ') || 'No details yet'}
            </p>
            {vetting.candidate_state && (
              <p className="mt-1 text-sm text-muted-foreground">{vetting.candidate_state}</p>
            )}
          </div>
          <StatusBadge status={vetting.stage} type="vetting" />
        </div>

        {/* Stage progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {STAGE_ORDER.map((stage, i) => (
              <span
                key={stage}
                className={i <= stageIndex ? 'font-medium text-foreground' : ''}
              >
                {formatLabel(stage)}
              </span>
            ))}
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${((stageIndex + 1) / STAGE_ORDER.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Key details */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Committee</dt>
            <dd className="text-sm font-medium">
              {vetting.committee?.name ?? 'Not assigned'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Primary Date</dt>
            <dd className="text-sm font-medium">
              {vetting.election_deadline?.primary_date
                ? formatDate(vetting.election_deadline.primary_date)
                : 'Not set'}
              {urgency !== 'normal' && (
                <span className={`ml-2 text-xs font-semibold ${
                  urgency === 'red'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {urgency === 'red' ? 'URGENT' : 'APPROACHING'}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">General Date</dt>
            <dd className="text-sm font-medium">
              {vetting.election_deadline?.general_date
                ? formatDate(vetting.election_deadline.general_date)
                : 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Recommendation</dt>
            <dd className="text-sm font-medium">
              {vetting.recommendation
                ? formatLabel(vetting.recommendation)
                : 'Pending'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Interview</dt>
            <dd className="text-sm font-medium">
              {vetting.interview_date
                ? formatDate(vetting.interview_date)
                : 'Not scheduled'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="text-sm font-medium">{formatDate(vetting.created_at)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
