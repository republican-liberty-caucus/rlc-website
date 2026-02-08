'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

const ADMIN_INPUT_CLASS = 'w-full rounded-md border bg-background px-3 py-2 text-sm';
const ADMIN_LABEL_CLASS = 'mb-1 block text-sm font-medium';

interface QuestionInput {
  questionText: string;
  questionType: 'scale' | 'yes_no' | 'text' | 'multiple_choice';
  weight: number;
  idealAnswer: string;
}

interface SurveyFormProps {
  chapters: { id: string; name: string }[];
}

export function SurveyForm({ chapters }: SurveyFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [electionType, setElectionType] = React.useState('');
  const [electionDate, setElectionDate] = React.useState('');
  const [state, setState] = React.useState('');
  const [chapterId, setChapterId] = React.useState('');
  const [questions, setQuestions] = React.useState<QuestionInput[]>([
    { questionText: '', questionType: 'scale', weight: 1, idealAnswer: '5' },
  ]);

  function generateSlug(t: string) {
    return t
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 200);
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
          electionDate: electionDate || undefined,
          state: state || undefined,
          chapterId: chapterId || undefined,
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
          <div>
            <label className={ADMIN_LABEL_CLASS}>Election Type</label>
            <select
              value={electionType}
              onChange={(e) => setElectionType(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="">Select type</option>
              <option value="primary">Primary</option>
              <option value="general">General</option>
              <option value="special">Special Election</option>
            </select>
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Election Date</label>
            <input
              type="date"
              value={electionDate}
              onChange={(e) => setElectionDate(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={ADMIN_INPUT_CLASS}
              placeholder="e.g., TX"
            />
          </div>
          <div>
            <label className={ADMIN_LABEL_CLASS}>Chapter</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className={ADMIN_INPUT_CLASS}
            >
              <option value="">National</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Questions</h2>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
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
