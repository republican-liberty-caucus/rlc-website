'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScoreBadge } from '@/components/ui/score-badge';
import type { VettingFullData, VettingPermissions } from '../types';

// ─── Types ────────────────────────────────────────────────────────

interface AuditPlatform {
  id: string;
  entity_type: string;
  entity_name: string;
  platform_name: string;
  platform_url: string | null;
  confidence_score: number | null;
  discovery_method: string | null;
  activity_status: string | null;
  score_presence: number | null;
  score_consistency: number | null;
  score_quality: number | null;
  score_accessibility: number | null;
  total_score: number | null;
  grade: string | null;
}

interface RiskItem {
  category: string;
  severity: string;
  description: string;
  mitigation: string;
  platformUrl?: string;
}

interface ScoreBreakdownData {
  digitalPresence: number;
  campaignConsistency: number;
  communicationQuality: number;
  voterAccessibility: number;
  competitivePositioning: number;
  total: number;
  grade: string;
}

interface OpponentAuditData {
  name: string;
  party: string | null;
  platformCount: number;
  overallScore: number | null;
  grade: string | null;
}

interface AuditData {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  candidate_overall_score: number | null;
  candidate_grade: string | null;
  candidate_score_breakdown: ScoreBreakdownData | null;
  candidate_risks: RiskItem[] | null;
  opponent_audits: OpponentAuditData[] | null;
  error_message: string | null;
  platforms: AuditPlatform[];
}

// ─── Props ────────────────────────────────────────────────────────

interface VettingAuditTabProps {
  vettingId: string;
  vetting: VettingFullData;
  permissions: VettingPermissions;
}

// ─── Severity Colors ──────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  NONE: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  audit_pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  running: { label: 'Running...', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  audit_completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  audit_failed: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};

// ─── Component ────────────────────────────────────────────────────

export function VettingAuditTab({ vettingId, vetting, permissions }: VettingAuditTabProps) {
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canTrigger = permissions.isChair || permissions.isNational;

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vettingId}/audit`);
      if (!res.ok) throw new Error('Failed to fetch audit');
      const data = await res.json();
      setAudit(data.audit ?? null);
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit');
    } finally {
      setLoading(false);
    }
  }, [vettingId]);

  const triggerAudit = useCallback(async (force = false) => {
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vettingId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to trigger audit');
      }

      // Refresh after a short delay (audit runs in background)
      setTimeout(() => fetchAudit(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger audit');
    } finally {
      setTriggering(false);
    }
  }, [vettingId, fetchAudit]);

  // Load on mount
  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  if (loading && !fetched) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading audit data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Status banner + trigger button */}
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Audit Status:</span>
          {audit ? (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              STATUS_LABELS[audit.status]?.color ?? 'bg-muted text-muted-foreground'
            }`}>
              {STATUS_LABELS[audit.status]?.label ?? audit.status}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No audit run yet</span>
          )}
          {audit?.status === 'audit_failed' && audit.error_message && (
            <span className="text-xs text-red-600 dark:text-red-400">{audit.error_message}</span>
          )}
        </div>

        {canTrigger && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => triggerAudit(false)}
              disabled={triggering || audit?.status === 'running'}
            >
              {triggering ? 'Starting...' : audit ? 'Re-run Audit' : 'Run Digital Audit'}
            </Button>
            {audit?.status === 'running' && (
              <Button size="sm" variant="outline" onClick={fetchAudit} disabled={loading}>
                Refresh
              </Button>
            )}
          </div>
        )}
      </div>

      {/* AI-generated notice */}
      {audit?.status === 'audit_completed' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          AI-generated &mdash; review required before publishing or sharing
        </div>
      )}

      {/* Overall Score Card */}
      {audit?.status === 'audit_completed' && audit.candidate_overall_score != null && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Overall Score
              </h3>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl font-bold">{audit.candidate_overall_score}</span>
                <span className="text-lg text-muted-foreground">/ 100</span>
                <ScoreBadge score={audit.candidate_overall_score} size="lg" />
              </div>
            </div>
          </div>

          {audit.candidate_score_breakdown && (
            <div className="mt-6 grid gap-3 sm:grid-cols-5">
              {renderDimension('Digital Presence', audit.candidate_score_breakdown.digitalPresence)}
              {renderDimension('Campaign Consistency', audit.candidate_score_breakdown.campaignConsistency)}
              {renderDimension('Communication', audit.candidate_score_breakdown.communicationQuality)}
              {renderDimension('Voter Access', audit.candidate_score_breakdown.voterAccessibility)}
              {renderDimension('Competitive', audit.candidate_score_breakdown.competitivePositioning)}
            </div>
          )}
        </div>
      )}

      {/* Risk Assessment */}
      {audit?.candidate_risks && audit.candidate_risks.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Risk Assessment
          </h3>
          <div className="space-y-3">
            {audit.candidate_risks.map((risk, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border bg-background p-3"
              >
                <span className={`mt-0.5 inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                  SEVERITY_COLORS[risk.severity] ?? SEVERITY_COLORS.NONE
                }`}>
                  {risk.severity}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{risk.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{risk.mitigation}</p>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{risk.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Grid */}
      {audit?.platforms && audit.platforms.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Discovered Platforms ({audit.platforms.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Platform</th>
                  <th className="pb-2 pr-4">Entity</th>
                  <th className="pb-2 pr-4">Confidence</th>
                  <th className="pb-2 pr-4">P</th>
                  <th className="pb-2 pr-4">C</th>
                  <th className="pb-2 pr-4">Q</th>
                  <th className="pb-2 pr-4">A</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Grade</th>
                  <th className="pb-2">Method</th>
                </tr>
              </thead>
              <tbody>
                {audit.platforms.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {p.platform_url ? (
                        <a
                          href={p.platform_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {p.platform_name}
                        </a>
                      ) : (
                        p.platform_name
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-xs ${
                        p.entity_type === 'candidate'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {p.entity_type}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {p.confidence_score != null
                        ? `${Math.round(p.confidence_score * 100)}%`
                        : '—'}
                    </td>
                    <td className="py-2 pr-4">{p.score_presence ?? '—'}</td>
                    <td className="py-2 pr-4">{p.score_consistency ?? '—'}</td>
                    <td className="py-2 pr-4">{p.score_quality ?? '—'}</td>
                    <td className="py-2 pr-4">{p.score_accessibility ?? '—'}</td>
                    <td className="py-2 pr-4 font-medium">{p.total_score ?? '—'}</td>
                    <td className="py-2 pr-4">{p.grade ?? '—'}</td>
                    <td className="py-2 text-xs text-muted-foreground">{p.discovery_method ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Opponent Comparison */}
      {audit?.opponent_audits && audit.opponent_audits.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Opponent Comparison
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {audit.opponent_audits.map((opp, i) => (
              <div key={i} className="rounded-lg border bg-background p-4">
                <h4 className="font-medium">{opp.name}</h4>
                {opp.party && (
                  <p className="text-xs text-muted-foreground">{opp.party}</p>
                )}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Platforms:</span>{' '}
                    <span className="font-medium">{opp.platformCount}</span>
                  </div>
                  {opp.overallScore != null && (
                    <div>
                      <span className="text-muted-foreground">Avg Score:</span>{' '}
                      <span className="font-medium">{opp.overallScore}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!audit && fetched && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            No digital presence audit has been run for this candidate yet.
          </p>
          {canTrigger && (
            <Button className="mt-4" onClick={() => triggerAudit(false)} disabled={triggering}>
              {triggering ? 'Starting...' : 'Run Digital Audit'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function renderDimension(label: string, value: number) {
  const pct = (value / 20) * 100;
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium">{value.toFixed(1)}</span>
      </div>
    </div>
  );
}
