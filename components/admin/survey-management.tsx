'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Copy, ExternalLink } from 'lucide-react';

interface Candidate {
  id: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  status: string;
  total_score: number | null;
  access_token: string;
  submitted_at: string | null;
  created_at: string;
}

interface SurveyManagementProps {
  surveyId: string;
  surveyStatus: string;
  candidates: Candidate[];
}

export function SurveyManagement({ surveyId, surveyStatus, candidates }: SurveyManagementProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);

  const [candidateName, setCandidateName] = React.useState('');
  const [candidateEmail, setCandidateEmail] = React.useState('');
  const [candidateOffice, setCandidateOffice] = React.useState('');
  const [candidateDistrict, setCandidateDistrict] = React.useState('');

  async function addCandidate() {
    if (!candidateName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/surveys/${surveyId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateEmail: candidateEmail || undefined,
          candidateOffice: candidateOffice || undefined,
          candidateDistrict: candidateDistrict || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Candidate added', description: `Survey link generated for ${candidateName}` });
      setCandidateName('');
      setCandidateEmail('');
      setCandidateOffice('');
      setCandidateDistrict('');
      setShowAddForm(false);
      router.refresh();
    } catch {
      toast({ title: 'Error', description: 'Failed to add candidate', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/admin/surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
        return;
      }
      toast({ title: 'Status updated' });
      router.refresh();
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  }

  function copySurveyLink(token: string) {
    const url = `${window.location.origin}/candidate-surveys/respond?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied', description: 'Survey link copied to clipboard' });
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    submitted: 'bg-green-100 text-green-800',
    endorsed: 'bg-emerald-100 text-emerald-800',
    not_endorsed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-8">
      {/* Status Controls */}
      <div className="flex gap-3">
        {surveyStatus === 'draft' && (
          <Button
            onClick={() => updateStatus('active')}
            disabled={updating}
            className="bg-green-600 hover:bg-green-700"
          >
            Activate Survey
          </Button>
        )}
        {surveyStatus === 'active' && (
          <Button
            onClick={() => updateStatus('closed')}
            disabled={updating}
            variant="destructive"
          >
            Close Survey
          </Button>
        )}
        {surveyStatus === 'closed' && (
          <Button onClick={() => updateStatus('active')} disabled={updating} variant="outline">
            Reopen Survey
          </Button>
        )}
        <a
          href={`/candidate-surveys/${surveyId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Public Page
          </Button>
        </a>
      </div>

      {/* Candidates */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Candidates ({candidates.length})</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Candidate
          </Button>
        </div>

        {showAddForm && (
          <div className="border-b bg-muted/30 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Candidate name *"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="Email"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={candidateOffice}
                onChange={(e) => setCandidateOffice(e.target.value)}
                placeholder="Office (e.g., US House, TX-3)"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={candidateDistrict}
                onChange={(e) => setCandidateDistrict(e.target.value)}
                placeholder="District"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={addCandidate} disabled={saving}>
                {saving ? 'Adding...' : 'Add'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Candidate</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Office</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{c.candidate_name}</p>
                    {c.candidate_email && (
                      <p className="text-xs text-muted-foreground">{c.candidate_email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {c.candidate_office || '-'}
                    {c.candidate_district && `, ${c.candidate_district}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColors[c.status] || 'bg-gray-100'}`}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {c.total_score !== null ? `${c.total_score}%` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copySurveyLink(c.access_token)}
                      className="inline-flex items-center gap-1 text-sm text-rlc-red hover:underline"
                      title="Copy survey link"
                    >
                      <Copy className="h-3 w-3" />
                      Copy Link
                    </button>
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No candidates added yet. Click &quot;Add Candidate&quot; to get started.
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
