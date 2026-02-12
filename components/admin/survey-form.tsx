'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Trash2, Download } from 'lucide-react';
import { US_STATES } from '@/lib/constants/us-states';

const ADMIN_INPUT_CLASS = 'w-full rounded-md border bg-background px-3 py-2 text-sm';
const ADMIN_LABEL_CLASS = 'mb-1 block text-sm font-medium';

interface QuestionInput {
  questionText: string;
  questionType: 'scale' | 'yes_no' | 'text' | 'multiple_choice';
  weight: number;
  idealAnswer: string;
}

interface OfficeType {
  id: string;
  level: string;
  name: string;
}

interface SurveyFormProps {
  charters: { id: string; name: string }[];
}

const ELECTION_TYPES = [
  { value: 'primary', label: 'Primary' },
  { value: 'general', label: 'General' },
  { value: 'special', label: 'Special Election' },
  { value: 'runoff', label: 'Runoff' },
  { value: 'primary_runoff', label: 'Primary Runoff' },
] as const;

// Group office types by level for <optgroup>
function groupByLevel(types: OfficeType[]): Record<string, OfficeType[]> {
  const groups: Record<string, OfficeType[]> = {};
  for (const ot of types) {
    if (!groups[ot.level]) groups[ot.level] = [];
    groups[ot.level].push(ot);
  }
  return groups;
}

const LEVEL_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  county: 'County',
  municipal: 'Municipal',
  judicial: 'Judicial',
  special_district: 'Special District',
};

export function SurveyForm({ charters }: SurveyFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  // Survey details state
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [electionType, setElectionType] = React.useState('');
  const [primaryDate, setPrimaryDate] = React.useState('');
  const [generalDate, setGeneralDate] = React.useState('');
  const [state, setState] = React.useState('');
  const [charterId, setCharterId] = React.useState('');
  const [officeTypeId, setOfficeTypeId] = React.useState('');
  const [electionDeadlineId, setElectionDeadlineId] = React.useState('');
  const [datesAutoPopulated, setDatesAutoPopulated] = React.useState(false);

  // Office types fetched client-side based on charter selection
  const [officeTypes, setOfficeTypes] = React.useState<OfficeType[]>([]);
  const [loadingOfficeTypes, setLoadingOfficeTypes] = React.useState(false);

  // Questions
  const [questions, setQuestions] = React.useState<QuestionInput[]>([
    { questionText: '', questionType: 'scale', weight: 1, idealAnswer: '5' },
  ]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  // Derive selected office type's level for template loading
  const selectedOfficeType = officeTypes.find(ot => ot.id === officeTypeId);

  function generateSlug(t: string) {
    return t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 200);
  }

  // Fetch office types when charter changes
  React.useEffect(() => {
    if (!charterId) {
      setOfficeTypes([]);
      setOfficeTypeId('');
      return;
    }

    setLoadingOfficeTypes(true);
    fetch(`/api/v1/office-types?charterId=${charterId}`)
      .then(res => res.json())
      .then(data => {
        setOfficeTypes(data.officeTypes || []);
        // Reset office type if it's no longer in the list
        setOfficeTypeId(prev => {
          const still = (data.officeTypes || []).some((ot: OfficeType) => ot.id === prev);
          return still ? prev : '';
        });
      })
      .catch(() => setOfficeTypes([]))
      .finally(() => setLoadingOfficeTypes(false));
  }, [charterId]);

  // Auto-lookup election dates when state + office type are both selected
  React.useEffect(() => {
    if (!state || !selectedOfficeType) {
      setElectionDeadlineId('');
      setDatesAutoPopulated(false);
      return;
    }

    const abortController = new AbortController();
    const cycleYear = new Date().getFullYear();
    const params = new URLSearchParams({
      stateCode: state,
      cycleYear: String(cycleYear),
      officeType: selectedOfficeType.name,
    });

    fetch(`/api/v1/admin/election-deadlines/lookup?${params}`, {
      signal: abortController.signal,
    })
      .then(res => res.json())
      .then(data => {
        if (data.deadline) {
          setElectionDeadlineId(data.deadline.id);
          if (data.deadline.primary_date) setPrimaryDate(data.deadline.primary_date.split('T')[0]);
          if (data.deadline.general_date) setGeneralDate(data.deadline.general_date.split('T')[0]);
          setDatesAutoPopulated(true);
        } else {
          setElectionDeadlineId('');
          setDatesAutoPopulated(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setElectionDeadlineId('');
          setDatesAutoPopulated(false);
        }
      });

    return () => abortController.abort();
  }, [state, selectedOfficeType]);

  async function loadStandardQuestions() {
    if (!selectedOfficeType) return;

    const hasExistingContent = questions.some(q => q.questionText.trim());
    if (hasExistingContent) {
      const ok = window.confirm(
        'This will replace all current questions with standard templates. Continue?'
      );
      if (!ok) return;
    }

    setLoadingTemplates(true);
    try {
      const res = await fetch(
        `/api/v1/admin/question-templates?officeLevel=${selectedOfficeType.level}`
      );

      if (!res.ok) {
        toast({ title: 'Error', description: `Failed to load templates (${res.status})`, variant: 'destructive' });
        return;
      }

      const data = await res.json();
      const templates = data.templates || [];

      if (templates.length === 0) {
        toast({
          title: 'No templates',
          description: `No standard questions for ${LEVEL_LABELS[selectedOfficeType.level] || selectedOfficeType.level} races yet`,
        });
        return;
      }

      setQuestions(
        templates.map((t: { question_text: string; question_type: string; weight: number; ideal_answer: string | null }) => ({
          questionText: t.question_text,
          questionType: t.question_type as QuestionInput['questionType'],
          weight: t.weight,
          idealAnswer: t.ideal_answer || '',
        }))
      );

      toast({
        title: 'Templates loaded',
        description: `Loaded ${templates.length} standard questions for ${selectedOfficeType.name}`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
    } finally {
      setLoadingTemplates(false);
    }
  }

  function addQuestion() {
    setQuestions([...questions, { questionText: '', questionType: 'scale', weight: 1, idealAnswer: '5' }]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, field: keyof QuestionInput, value: string | number) {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast({ title: 'Error', description: 'Title is required', variant: 'destructive' });
      return;
    }

    const validQuestions = questions.filter(q => q.questionText.trim());
    if (validQuestions.length === 0) {
      toast({ title: 'Error', description: 'At least one question is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: slug || generateSlug(title),
          description: description || undefined,
          electionType: electionType || undefined,
          primaryDate: primaryDate || undefined,
          generalDate: generalDate || undefined,
          state: state || undefined,
          charterId: charterId || undefined,
          officeTypeId: officeTypeId || undefined,
          electionDeadlineId: electionDeadlineId || undefined,
          questions: validQuestions.map((q, i) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            weight: q.weight,
            sortOrder: i,
            idealAnswer: q.idealAnswer || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to create survey', variant: 'destructive' });
        return;
      }

      toast({ title: 'Success', description: 'Survey created successfully' });
      router.push(`/admin/surveys/${data.survey.id}`);
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const officeTypeGroups = groupByLevel(officeTypes);

  return (
    <div className="space-y-8">
      {/* Survey Details */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Survey Details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL_CLASS}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug) setSlug(generateSlug(e.target.value));
              }}
              className={ADMIN_INPUT_CLASS}
              placeholder="2026 Congressional Primary Survey"
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={ADMIN_INPUT_CLASS}
              placeholder="Auto-generated from title"
            />
          </div>
          <div className="md:col-span-2">
            <label className={ADMIN_LABEL_CLASS}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={ADMIN_INPUT_CLASS}
              rows={3}
            />
          </div>

          {/* Charter → Office Type cascading */}
          <div>
            <label className={ADMIN_LABEL_CLASS}>Charter</label>
            <select
              value={charterId}
              onChange={(e) => setCharterId(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="">National</option>
              {charters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Office Type</label>
            <select
              value={officeTypeId}
              onChange={(e) => setOfficeTypeId(e.target.value)}
              className={ADMIN_INPUT_CLASS}
              disabled={!charterId || loadingOfficeTypes}
            >
              <option value="">
                {!charterId ? 'Select a charter first' : loadingOfficeTypes ? 'Loading...' : 'Select office type'}
              </option>
              {Object.entries(officeTypeGroups).map(([level, types]) => (
                <optgroup key={level} label={LEVEL_LABELS[level] || level}>
                  {types.map(ot => (
                    <option key={ot.id} value={ot.id}>{ot.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Election Type + State */}
          <div>
            <label className={ADMIN_LABEL_CLASS}>Election Type</label>
            <select
              value={electionType}
              onChange={(e) => setElectionType(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="">Select type</option>
              {ELECTION_TYPES.map(et => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>State</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="">Select state</option>
              {US_STATES.map(s => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Primary Date + General Date */}
          <div>
            <label className={ADMIN_LABEL_CLASS}>Primary Date</label>
            <input
              type="date"
              value={primaryDate}
              onChange={(e) => {
                setPrimaryDate(e.target.value);
                if (datesAutoPopulated) setDatesAutoPopulated(false);
              }}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>General Date</label>
            <input
              type="date"
              value={generalDate}
              onChange={(e) => {
                setGeneralDate(e.target.value);
                if (datesAutoPopulated) setDatesAutoPopulated(false);
              }}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
          {datesAutoPopulated && (
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">
                Dates loaded from election calendar. Edit above to override.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Questions</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadStandardQuestions}
              disabled={!selectedOfficeType || loadingTemplates}
            >
              <Download className="mr-2 h-4 w-4" />
              {loadingTemplates ? 'Loading...' : 'Load Standard Questions'}
            </Button>
            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </div>
        </div>
        <div className="space-y-6">
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Question {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="text-muted-foreground hover:text-red-600"
                  disabled={questions.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={ADMIN_LABEL_CLASS}>Question Text *</label>
                  <input
                    type="text"
                    value={q.questionText}
                    onChange={(e) => updateQuestion(i, 'questionText', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    placeholder="Do you support reducing federal spending?"
                  />
                </div>
                <div>
                  <label className={ADMIN_LABEL_CLASS}>Type</label>
                  <select
                    value={q.questionType}
                    onChange={(e) => updateQuestion(i, 'questionType', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                  >
                    <option value="scale">Scale (1-5)</option>
                    <option value="yes_no">Yes/No</option>
                    <option value="text">Free Text</option>
                    <option value="multiple_choice">Multiple Choice</option>
                  </select>
                </div>
                <div>
                  <label className={ADMIN_LABEL_CLASS}>Weight</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={q.weight}
                    onChange={(e) => updateQuestion(i, 'weight', parseFloat(e.target.value) || 1)}
                    className={ADMIN_INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={ADMIN_LABEL_CLASS}>
                    Ideal Answer <span className="text-muted-foreground">(for auto-scoring)</span>
                  </label>
                  <input
                    type="text"
                    value={q.idealAnswer}
                    onChange={(e) => updateQuestion(i, 'idealAnswer', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    placeholder={q.questionType === 'scale' ? '5' : q.questionType === 'yes_no' ? 'yes' : ''}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-rlc-red hover:bg-rlc-red/90"
          disabled={saving}
          onClick={handleSubmit}
        >
          {saving ? 'Creating...' : 'Create Survey'}
        </Button>
      </div>
    </div>
  );
}
