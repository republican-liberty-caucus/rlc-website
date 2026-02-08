'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  sort_order: number;
}

interface CandidateSurveyFormProps {
  accessToken: string;
  questions: Question[];
}

export function CandidateSurveyForm({ accessToken, questions }: CandidateSurveyFormProps) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function setAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    // Check all questions are answered
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      setError(`Please answer all ${unanswered.length} remaining question(s).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit survey');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
        <h2 className="mt-6 text-2xl font-bold">Thank You!</h2>
        <p className="mt-4 text-muted-foreground">
          Your survey response has been submitted successfully. Your answers will be
          scored and published on our candidate survey results page.
        </p>
        <Button
          className="mt-8"
          variant="outline"
          onClick={() => router.push('/candidate-surveys')}
        >
          View All Surveys
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-lg border bg-card p-6">
          <p className="mb-4 font-medium">
            <span className="text-muted-foreground">{i + 1}.</span> {q.question_text}
          </p>

          {q.question_type === 'scale' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Strongly Disagree</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAnswer(q.id, String(val))}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                      answers[q.id] === String(val)
                        ? 'border-rlc-red bg-rlc-red text-white'
                        : 'border-muted hover:border-rlc-red'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Strongly Agree</span>
            </div>
          )}

          {q.question_type === 'yes_no' && (
            <div className="flex gap-3">
              {['Yes', 'No'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAnswer(q.id, val.toLowerCase())}
                  className={`rounded-lg border-2 px-6 py-2 text-sm font-medium transition-colors ${
                    answers[q.id] === val.toLowerCase()
                      ? 'border-rlc-red bg-rlc-red/10 text-rlc-red'
                      : 'border-muted hover:border-rlc-red'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          )}

          {q.question_type === 'text' && (
            <textarea
              value={answers[q.id] || ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              rows={4}
              className="w-full rounded-lg border bg-background px-4 py-3 text-sm focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
              placeholder="Enter your response..."
            />
          )}

          {q.question_type === 'multiple_choice' && q.options.length > 0 && (
            <div className="space-y-2">
              {q.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswer(q.id, option)}
                  className={`block w-full rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors ${
                    answers[q.id] === option
                      ? 'border-rlc-red bg-rlc-red/10 text-rlc-red'
                      : 'border-muted hover:border-rlc-red'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      <div className="flex justify-end">
        <Button
          className="bg-rlc-red hover:bg-rlc-red/90"
          size="lg"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Submitting...' : 'Submit Survey'}
        </Button>
      </div>
    </div>
  );
}
