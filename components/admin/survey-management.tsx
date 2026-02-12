'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Copy, ExternalLink, Eye, Play } from 'lucide-react';
import type { OfficeType } from '@/types';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'AS', name: 'American Samoa' }, { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' }, { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'US Virgin Islands' },
];

interface Candidate {
  id: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  office_type: { name: string; district_label: string | null } | null;
  candidate_state: string | null;
  candidate_county: string | null;
  status: string;
  total_score: number | null;
  access_token: string;
  submitted_at: string | null;
  created_at: string;
}

interface SurveyManagementProps {
  surveyId: string;
  surveyStatus: string;
  charterId: string | null;
  candidates: Candidate[];
  vettingMap: Record<string, string>;
}

const inputClass = 'rounded-md border bg-background px-3 py-2 text-sm';
const selectClass = 'rounded-md border bg-background px-3 py-2 text-sm';

export function SurveyManagement({ surveyId, surveyStatus, charterId, candidates, vettingMap }: SurveyManagementProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const [startingVetting, setStartingVetting] = React.useState<string | null>(null);

  // Form fields
  const [candidateName, setCandidateName] = React.useState('');
  const [candidateEmail, setCandidateEmail] = React.useState('');
  const [officeTypeId, setOfficeTypeId] = React.useState('');
  const [candidateState, setCandidateState] = React.useState('');
  const [candidateCounty, setCandidateCounty] = React.useState('');
  const [candidateDistrict, setCandidateDistrict] = React.useState('');

  // Office types fetched from API
  const [officeTypes, setOfficeTypes] = React.useState<OfficeType[]>([]);
  const [loadingOfficeTypes, setLoadingOfficeTypes] = React.useState(false);

  const selectedOfficeType = officeTypes.find((ot) => ot.id === officeTypeId);

  // Fetch office types when form opens
  React.useEffect(() => {
    if (!showAddForm || officeTypes.length > 0) return;

    setLoadingOfficeTypes(true);
    const params = new URLSearchParams();
    if (charterId) params.set('charterId', charterId);

    fetch(`/api/v1/office-types?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setOfficeTypes(data.officeTypes ?? []))
      .catch(() => toast({ title: 'Error', description: 'Failed to load office types', variant: 'destructive' }))
      .finally(() => setLoadingOfficeTypes(false));
  }, [showAddForm, charterId, officeTypes.length, toast]);

  // Reset dependent fields when office type changes
  React.useEffect(() => {
    if (!selectedOfficeType?.requires_county) setCandidateCounty('');
    if (!selectedOfficeType?.requires_district) setCandidateDistrict('');
    if (!selectedOfficeType?.requires_state) setCandidateState('');
  }, [officeTypeId, selectedOfficeType]);

  function resetForm() {
    setCandidateName('');
    setCandidateEmail('');
    setOfficeTypeId('');
    setCandidateState('');
    setCandidateCounty('');
    setCandidateDistrict('');
  }

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
          candidateOffice: selectedOfficeType?.name || undefined,
          candidateDistrict: candidateDistrict || undefined,
          officeTypeId: officeTypeId || undefined,
          candidateState: candidateState || undefined,
          candidateCounty: candidateCounty || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Candidate added', description: `Survey link generated for ${candidateName}` });
      resetForm();
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

  async function startVetting(candidateResponseId: string) {
    setStartingVetting(candidateResponseId);
    try {
      const res = await fetch('/api/v1/admin/vetting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateResponseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({ title: 'Already exists', description: 'A vetting already exists for this candidate.' });
          router.refresh();
          return;
        }
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Vetting started', description: 'Candidate moved to the vetting pipeline.' });
      router.refresh();
      router.push(`/admin/vetting/${data.vetting.id}`);
    } catch (error) {
      console.error('Failed to start vetting:', error);
      toast({ title: 'Error', description: 'Failed to start vetting', variant: 'destructive' });
    } finally {
      setStartingVetting(null);
    }
  }

  function formatOfficeDisplay(c: Candidate): string {
    const name = c.office_type?.name ?? c.candidate_office;
    if (!name) return '-';
    const parts = [name];
    if (c.candidate_state) parts.push(c.candidate_state);
    if (c.candidate_district) {
      const label = c.office_type?.district_label ?? 'District';
      parts.push(`${label} ${c.candidate_district}`);
    }
    return parts.join(' - ');
  }

  // Group office types by level for the dropdown
  const levelLabels: Record<string, string> = {
    federal: 'Federal',
    state: 'State',
    county: 'County',
    municipal: 'Municipal',
    judicial: 'Judicial',
    special_district: 'Special District',
  };

  const groupedOfficeTypes = officeTypes.reduce<Record<string, OfficeType[]>>((acc, ot) => {
    const group = levelLabels[ot.level] || ot.level;
    if (!acc[group]) acc[group] = [];
    acc[group].push(ot);
    return acc;
  }, {});

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
                className={inputClass}
              />
              <input
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="Email"
                className={inputClass}
              />

              {/* Office Type dropdown (grouped by level) */}
              <select
                value={officeTypeId}
                onChange={(e) => setOfficeTypeId(e.target.value)}
                className={selectClass}
                disabled={loadingOfficeTypes}
              >
                <option value="">{loadingOfficeTypes ? 'Loading offices...' : 'Select office type'}</option>
                {Object.entries(groupedOfficeTypes).map(([group, types]) => (
                  <optgroup key={group} label={group}>
                    {types.map((ot) => (
                      <option key={ot.id} value={ot.id}>{ot.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* State dropdown (shown when office requires state) */}
              {selectedOfficeType?.requires_state !== false && (
                <select
                  value={candidateState}
                  onChange={(e) => setCandidateState(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              )}

              {/* County (shown when office requires county) */}
              {selectedOfficeType?.requires_county && (
                <input
                  type="text"
                  value={candidateCounty}
                  onChange={(e) => setCandidateCounty(e.target.value)}
                  placeholder="County"
                  className={inputClass}
                />
              )}

              {/* District/Ward/Seat/Circuit (shown when office requires district) */}
              {selectedOfficeType?.requires_district && (
                <input
                  type="text"
                  value={candidateDistrict}
                  onChange={(e) => setCandidateDistrict(e.target.value)}
                  placeholder={selectedOfficeType.district_label || 'District'}
                  className={inputClass}
                />
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={addCandidate} disabled={saving}>
                {saving ? 'Adding...' : 'Add'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</Button>
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
              {candidates.map((c) => {
                const existingVettingId = vettingMap[c.id];
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {c.status === 'submitted' ? (
                        <Link
                          href={`/admin/surveys/${surveyId}/candidates/${c.id}`}
                          className="text-sm font-medium text-rlc-red hover:underline"
                        >
                          {c.candidate_name}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium">{c.candidate_name}</p>
                      )}
                      {c.candidate_email && (
                        <p className="text-xs text-muted-foreground">{c.candidate_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatOfficeDisplay(c)}
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copySurveyLink(c.access_token)}
                          className="inline-flex items-center gap-1 text-sm text-rlc-red hover:underline"
                          title="Copy survey link"
                        >
                          <Copy className="h-3 w-3" />
                          Copy Link
                        </button>
                        {c.status === 'submitted' && (
                          <>
                            <Link
                              href={`/admin/surveys/${surveyId}/candidates/${c.id}`}
                              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                              title="View survey answers"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Link>
                            {existingVettingId ? (
                              <Link
                                href={`/admin/vetting/${existingVettingId}`}
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                title="View in vetting pipeline"
                              >
                                <Play className="h-3 w-3" />
                                Pipeline
                              </Link>
                            ) : (
                              <button
                                onClick={() => startVetting(c.id)}
                                disabled={startingVetting === c.id}
                                className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline disabled:opacity-50"
                                title="Start vetting process"
                              >
                                <Play className="h-3 w-3" />
                                {startingVetting === c.id ? 'Starting...' : 'Start Vetting'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
