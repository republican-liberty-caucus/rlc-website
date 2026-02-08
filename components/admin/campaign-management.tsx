'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Mail, Copy, Check } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ActionCampaign } from '@/types';

const STATUS_OPTIONS = ['draft', 'active', 'completed', 'cancelled'] as const;

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface ParticipationRow {
  id: string;
  action: string;
  legislator_id: string | null;
  created_at: string;
  member: { full_name: string; email: string } | null;
}

interface Props {
  campaign: ActionCampaign;
  participationCount: number;
}

export function CampaignManagement({ campaign, participationCount }: Props) {
  const [status, setStatus] = useState(campaign.status);
  const [loading, setLoading] = useState(false);
  const [participations, setParticipations] = useState<ParticipationRow[]>([]);
  const [copied, setCopied] = useState(false);

  const fetchParticipations = useCallback(async () => {
    const res = await fetch(`/api/v1/admin/campaigns/${campaign.id}?include=participations`);
    const data = await res.json();
    if (res.ok && data.participations) {
      setParticipations(data.participations);
    }
  }, [campaign.id]);

  useEffect(() => {
    // Only fetch detailed participations if we know there are some
    if (participationCount > 0) {
      fetchParticipations();
    }
  }, [fetchParticipations, participationCount]);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    const res = await fetch(`/api/v1/admin/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) setStatus(newStatus as ActionCampaign['status']);
    setLoading(false);
  }

  async function copyShareUrl() {
    const url = `${window.location.origin}/action-center/contact?campaign=${campaign.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const chamberLabel = campaign.target_chamber
    ? campaign.target_chamber.replace('us_', 'US ').replace('state_', 'State ').replace('house', 'House').replace('senate', 'Senate')
    : 'All Chambers';

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{campaign.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {chamberLabel}
            {campaign.target_state_code ? ` (${campaign.target_state_code})` : ''}
            {campaign.starts_at ? ` | ${formatDate(campaign.starts_at)}` : ''}
            {campaign.ends_at ? ` — ${formatDate(campaign.ends_at)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={loading}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[status] || ''}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Campaign Details */}
      {campaign.description && (
        <div className="mb-8 rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Description</h2>
          <p className="text-sm">{campaign.description}</p>
        </div>
      )}

      {/* Metrics */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-2xl font-bold">{participationCount}</p>
          <p className="text-xs text-muted-foreground">Total Participations</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <Mail className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-2xl font-bold">
            {participations.filter(p => p.action === 'email_sent').length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Emails Sent</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-2xl font-bold">
            {new Set(participations.map(p => p.member?.full_name).filter(Boolean)).size || 0}
          </p>
          <p className="text-xs text-muted-foreground">Unique Members</p>
        </div>
      </div>

      {/* Share URL */}
      {status === 'active' && (
        <div className="mb-8 rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Share Campaign</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
              /action-center/contact?campaign={campaign.slug}
            </code>
            <Button variant="outline" size="sm" onClick={copyShareUrl}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Message Template */}
      {campaign.message_template && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Message Template</h2>
          <div className="rounded-lg border bg-card p-4">
            <pre className="whitespace-pre-wrap text-sm">{campaign.message_template}</pre>
          </div>
        </div>
      )}

      {/* Participation Table */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Participation</h2>
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Member</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {participations.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm">
                      {p.member?.full_name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                      {p.action.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
                {participations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No participation yet. Share the campaign to get members involved.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
