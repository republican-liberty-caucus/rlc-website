'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Brain, Download } from 'lucide-react';
import { LegiscanSearch } from '@/components/admin/legiscan-search';
import { EmbedCodeGenerator } from '@/components/admin/embed-code-generator';
import type { ScorecardBill, ScorecardSession } from '@/types';

const STATUS_OPTIONS = ['draft', 'active', 'published', 'archived'] as const;

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-amber-100 text-amber-800',
};

const billStatusColors: Record<string, string> = {
  tracking: 'bg-yellow-100 text-yellow-800',
  voted: 'bg-green-100 text-green-800',
  no_vote: 'bg-gray-100 text-gray-800',
};

export function ScorecardManagement({ session }: { session: ScorecardSession }) {
  const [bills, setBills] = useState<ScorecardBill[]>([]);
  const [status, setStatus] = useState(session.status);
  const [description, setDescription] = useState(session.description || '');
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [analyzingBillId, setAnalyzingBillId] = useState<string | null>(null);
  const [importingBillId, setImportingBillId] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    const res = await fetch(`/api/v1/admin/scorecards/${session.id}/bills`);
    const data = await res.json();
    if (res.ok) setBills(data.bills || []);
  }, [session.id]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    const res = await fetch(`/api/v1/admin/scorecards/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) setStatus(newStatus as ScorecardSession['status']);
    setLoading(false);
  }

  async function analyzeBill(billId: string) {
    setAnalyzingBillId(billId);
    try {
      const res = await fetch(`/api/v1/admin/scorecards/${session.id}/bills/${billId}/analyze`, {
        method: 'POST',
      });
      if (res.ok) await fetchBills();
    } finally {
      setAnalyzingBillId(null);
    }
  }

  async function importVotes(billId: string) {
    setImportingBillId(billId);
    try {
      const res = await fetch(`/api/v1/admin/scorecards/${session.id}/bills/${billId}/votes`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Imported ${data.imported} of ${data.total} votes`);
        await fetchBills();
      } else {
        alert(data.error || 'Failed to import votes');
      }
    } finally {
      setImportingBillId(null);
    }
  }

  function handleBillAdded() {
    setShowSearch(false);
    fetchBills();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/scorecards" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Scorecards
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{session.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.jurisdiction === 'federal' ? 'Federal' : session.state_code} | {session.session_year}
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

      {/* Description */}
      <div className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Overview / Description</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Displayed on the public scorecard page. Supports plain text.
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter an overview of this scorecard session, scoring methodology, etc."
          rows={5}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={descriptionSaving}
          onClick={async () => {
            setDescriptionSaving(true);
            try {
              const res = await fetch(`/api/v1/admin/scorecards/${session.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: description || null }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to save description');
              }
            } catch {
              alert('Network error saving description');
            } finally {
              setDescriptionSaving(false);
            }
          }}
        >
          {descriptionSaving ? 'Saving...' : 'Save Description'}
        </Button>
      </div>

      {/* Bills Section */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Bills ({bills.length})</h2>
          <Button onClick={() => setShowSearch(!showSearch)} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Bill
          </Button>
        </div>

        {showSearch && (
          <div className="mb-6 rounded-lg border bg-muted/30 p-4">
            <LegiscanSearch sessionId={session.id} onBillAdded={handleBillAdded} />
          </div>
        )}

        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Bill</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Position</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">AI</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Weight</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{bill.bill_number}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm" title={bill.title}>{bill.title}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{bill.category}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        bill.liberty_position === 'yea' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {bill.liberty_position.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {bill.ai_suggested_position ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          bill.ai_suggested_position === bill.liberty_position
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                        }`} title={bill.ai_analysis || ''}>
                          {bill.ai_suggested_position.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${billStatusColors[bill.bill_status] || ''}`}>
                        {bill.bill_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{bill.weight}x</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => analyzeBill(bill.id)}
                          disabled={analyzingBillId === bill.id}
                          title="AI Analyze"
                        >
                          <Brain className={`h-4 w-4 ${analyzingBillId === bill.id ? 'animate-pulse' : ''}`} />
                        </Button>
                        {bill.legiscan_roll_call_id && bill.bill_status !== 'voted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => importVotes(bill.id)}
                            disabled={importingBillId === bill.id}
                            title="Import Votes"
                          >
                            <Download className={`h-4 w-4 ${importingBillId === bill.id ? 'animate-pulse' : ''}`} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No bills tracked yet. Click &ldquo;Add Bill&rdquo; to search LegiScan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Embed Code */}
      {(status === 'published' || status === 'active') && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Embed Widget</h2>
          <EmbedCodeGenerator slug={session.slug} />
        </div>
      )}
    </div>
  );
}
