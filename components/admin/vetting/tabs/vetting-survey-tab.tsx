'use client';

import type { SurveyResponseData } from '../types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function formatQuestionType(type: string): string {
  switch (type) {
    case 'scale': return 'Scale (1\u20135)';
    case 'yes_no': return 'Yes / No';
    case 'text': return 'Free Text';
    case 'multiple_choice': return 'Multiple Choice';
    default: return type;
  }
}

interface VettingSurveyTabProps {
  surveyResponse: SurveyResponseData | null;
}

export function VettingSurveyTab({ surveyResponse }: VettingSurveyTabProps) {
  if (!surveyResponse) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          No survey response linked to this vetting.
        </p>
      </div>
    );
  }

  const totalScore = surveyResponse.total_score !== null
    ? Number(surveyResponse.total_score)
    : null;

  return (
    <div className="space-y-6">
      {/* Survey metadata */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Survey Response
        </h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          {surveyResponse.survey && (
            <div>
              <dt className="text-sm text-muted-foreground">Survey</dt>
              <dd className="text-sm font-medium">{surveyResponse.survey.title}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd className="text-sm font-medium capitalize">{surveyResponse.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Submitted</dt>
            <dd className="text-sm font-medium">
              {surveyResponse.submitted_at
                ? formatDate(surveyResponse.submitted_at)
                : 'Not submitted'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Total Score</dt>
            <dd className={`text-sm font-semibold ${getScoreColor(totalScore)}`}>
              {totalScore !== null ? `${totalScore.toFixed(1)}%` : 'Not scored'}
            </dd>
          </div>
          {surveyResponse.candidate_email && (
            <div>
              <dt className="text-sm text-muted-foreground">Candidate Email</dt>
              <dd className="text-sm font-medium">{surveyResponse.candidate_email}</dd>
            </div>
          )}
          {surveyResponse.survey?.election_type && (
            <div>
              <dt className="text-sm text-muted-foreground">Election Type</dt>
              <dd className="text-sm font-medium capitalize">
                {surveyResponse.survey.election_type.replace(/_/g, ' ')}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Individual answers */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Answers ({surveyResponse.answers.length})
        </h3>

        {surveyResponse.answers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No answers recorded.</p>
        ) : (
          <div className="space-y-4">
            {surveyResponse.answers.map((a, idx) => {
              const answerScore = a.score !== null ? Number(a.score) : null;
              return (
                <div key={a.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        <span className="mr-2 text-muted-foreground">{idx + 1}.</span>
                        {a.question.question_text}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatQuestionType(a.question.question_type)}
                        {a.question.weight !== 1 && (
                          <span className="ml-2">
                            Weight: {Number(a.question.weight).toFixed(1)}x
                          </span>
                        )}
                      </p>
                    </div>
                    {answerScore !== null && (
                      <span className={`shrink-0 text-sm font-semibold ${getScoreColor(answerScore)}`}>
                        {answerScore.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Answer</p>
                      <p className="mt-0.5 text-sm">{a.answer}</p>
                    </div>
                    {a.question.ideal_answer && (
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Ideal Answer</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {a.question.ideal_answer}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
