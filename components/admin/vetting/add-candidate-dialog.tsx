'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/lib/hooks/use-toast';
import { formatCandidateName } from '@/lib/utils';
import { UserPlus } from 'lucide-react';
import type { OfficeType } from '@/types';
import { US_STATES } from '@/lib/constants/us-states';

interface Survey {
  id: string;
  title: string;
  state: string | null;
}

interface AddCandidateDialogProps {
  surveys: Survey[];
}

const fieldClass = 'rounded-md border bg-background px-3 py-2 text-sm';

const levelLabels: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  county: 'County',
  municipal: 'Municipal',
  judicial: 'Judicial',
  special_district: 'Special District',
};

export function AddCandidateDialog({ surveys }: AddCandidateDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const defaultSurveyId = surveys.length === 1 ? surveys[0].id : '';
  const [selectedSurveyId, setSelectedSurveyId] = React.useState(defaultSurveyId);
  const [candidateFirstName, setCandidateFirstName] = React.useState('');
  const [candidateLastName, setCandidateLastName] = React.useState('');
  const [candidateEmail, setCandidateEmail] = React.useState('');
  const [officeTypeId, setOfficeTypeId] = React.useState('');
  const [candidateState, setCandidateState] = React.useState('');
  const [candidateCounty, setCandidateCounty] = React.useState('');
  const [candidateDistrict, setCandidateDistrict] = React.useState('');

  const [officeTypes, setOfficeTypes] = React.useState<OfficeType[]>([]);
  const [loadingOfficeTypes, setLoadingOfficeTypes] = React.useState(false);

  const selectedOfficeType = officeTypes.find((ot) => ot.id === officeTypeId);

  // Fetch office types when dialog opens
  React.useEffect(() => {
    if (!open || officeTypes.length > 0) return;

    setLoadingOfficeTypes(true);
    fetch('/api/v1/office-types')
      .then((res) => res.json())
      .then((data) => setOfficeTypes(data.officeTypes ?? []))
      .catch(() => toast({ title: 'Error', description: 'Failed to load office types', variant: 'destructive' }))
      .finally(() => setLoadingOfficeTypes(false));
  }, [open, officeTypes.length, toast]);

  // Auto-fill state when survey has a state
  React.useEffect(() => {
    const survey = surveys.find((s) => s.id === selectedSurveyId);
    if (survey?.state) {
      setCandidateState(survey.state);
    }
  }, [selectedSurveyId, surveys]);

  // Reset dependent fields when office type changes
  // Only clear fields when an office type IS selected but doesn't require them
  React.useEffect(() => {
    if (!selectedOfficeType) return;
    if (!selectedOfficeType.requires_county) setCandidateCounty('');
    if (!selectedOfficeType.requires_district) setCandidateDistrict('');
    if (!selectedOfficeType.requires_state) setCandidateState('');
  }, [officeTypeId, selectedOfficeType]);

  function resetForm() {
    setSelectedSurveyId(defaultSurveyId);
    setCandidateFirstName('');
    setCandidateLastName('');
    setCandidateEmail('');
    setOfficeTypeId('');
    setCandidateState('');
    setCandidateCounty('');
    setCandidateDistrict('');
  }

  const groupedOfficeTypes = officeTypes.reduce<Record<string, OfficeType[]>>((acc, ot) => {
    const group = levelLabels[ot.level] || ot.level;
    if (!acc[group]) acc[group] = [];
    acc[group].push(ot);
    return acc;
  }, {});

  async function handleSubmit() {
    if (!selectedSurveyId) {
      toast({ title: 'Error', description: 'Please select a survey', variant: 'destructive' });
      return;
    }
    if (!candidateFirstName.trim()) {
      toast({ title: 'Error', description: 'First name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/surveys/${selectedSurveyId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateFirstName: candidateFirstName.trim(),
          candidateLastName: candidateLastName.trim(),
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
      toast({ title: 'Candidate added', description: `${formatCandidateName(candidateFirstName, candidateLastName)} added to the pipeline` });
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error('[AddCandidateDialog] Failed to add candidate:', err);
      toast({ title: 'Error', description: 'Failed to add candidate', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
          <DialogDescription>Add a new candidate to the vetting pipeline.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* Survey picker */}
          {surveys.length > 1 ? (
            <select
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Select survey *</option>
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          ) : surveys.length === 1 ? (
            <p className="text-sm text-muted-foreground">
              Survey: <span className="font-medium text-foreground">{surveys[0].title}</span>
            </p>
          ) : (
            <p className="text-sm text-destructive">No active surveys. Create a survey first.</p>
          )}

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={candidateFirstName}
              onChange={(e) => setCandidateFirstName(e.target.value)}
              placeholder="First name *"
              className={fieldClass}
            />
            <input
              type="text"
              value={candidateLastName}
              onChange={(e) => setCandidateLastName(e.target.value)}
              placeholder="Last name"
              className={fieldClass}
            />
          </div>
          <input
            type="email"
            value={candidateEmail}
            onChange={(e) => setCandidateEmail(e.target.value)}
            placeholder="Email (optional)"
            className={fieldClass}
          />

          {/* Office Type dropdown (grouped by level) */}
          <select
            value={officeTypeId}
            onChange={(e) => setOfficeTypeId(e.target.value)}
            className={fieldClass}
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
              className={fieldClass}
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
              className={fieldClass}
            />
          )}

          {/* District/Ward/Seat/Circuit (shown when office requires district) */}
          {selectedOfficeType?.requires_district && (
            <input
              type="text"
              value={candidateDistrict}
              onChange={(e) => setCandidateDistrict(e.target.value)}
              placeholder={selectedOfficeType.district_label || 'District'}
              className={fieldClass}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || surveys.length === 0 || loadingOfficeTypes}>
            {saving ? 'Adding...' : 'Add Candidate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
