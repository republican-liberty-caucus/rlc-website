'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import {
  getNextStage,
  canAdvanceStage,
  getIncompleteSections,
} from '@/lib/vetting/engine';
import { VETTING_RECOMMENDATIONS } from '@/lib/validations/vetting';
import type { VettingFullData, VettingPermissions } from '../types';

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface VettingStageActionsTabProps {
  vetting: VettingFullData;
  permissions: VettingPermissions;
}

export function VettingStageActionsTab({ vetting, permissions }: VettingStageActionsTabProps) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);
  const [savingRec, setSavingRec] = useState(false);
  const [savingPressRelease, setSavingPressRelease] = useState(false);

  // Interview form state
  const [interviewDate, setInterviewDate] = useState(
    vetting.interview_date ? vetting.interview_date.slice(0, 16) : ''
  );
  const [interviewNotes, setInterviewNotes] = useState(vetting.interview_notes ?? '');
  const [interviewers, setInterviewers] = useState(
    (vetting.interviewers ?? []).join(', ')
  );

  // Recommendation form state
  const [recommendation, setRecommendation] = useState(vetting.recommendation ?? '');
  const [recNotes, setRecNotes] = useState(vetting.recommendation_notes ?? '');

  // Press release form state
  const [pressReleaseUrl, setPressReleaseUrl] = useState(vetting.press_release_url ?? '');
  const [pressReleaseNotes, setPressReleaseNotes] = useState(vetting.press_release_notes ?? '');

  const nextStage = getNextStage(vetting.stage);
  const sections = vetting.report_sections.map((s) => ({
    section: s.section,
    status: s.status,
  }));

  const gateResult = nextStage
    ? canAdvanceStage(vetting.stage, nextStage, sections, {
        hasRecommendation: !!vetting.recommendation,
        hasEndorsementResult: !!vetting.endorsement_result,
      })
    : { allowed: false, reason: 'Final stage reached' };

  const incompleteSections = getIncompleteSections(sections);

  async function handleAdvanceStage() {
    if (!nextStage) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vetting.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStage: nextStage }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.reason || err?.error || 'Failed to advance stage');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleSaveInterview() {
    setSavingInterview(true);
    try {
      const body: Record<string, unknown> = {};
      if (interviewDate) {
        const d = new Date(interviewDate);
        if (isNaN(d.getTime())) {
          alert('Invalid interview date');
          return;
        }
        body.interviewDate = d.toISOString();
      }
      if (interviewNotes) body.interviewNotes = interviewNotes;
      if (interviewers.trim()) {
        body.interviewers = interviewers.split(',').map((s) => s.trim()).filter(Boolean);
      }

      if (Object.keys(body).length === 0) return;

      const res = await fetch(`/api/v1/admin/vetting/${vetting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to save interview data');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setSavingInterview(false);
    }
  }

  async function handleSavePressRelease() {
    setSavingPressRelease(true);
    try {
      const body: Record<string, unknown> = {};
      if (pressReleaseUrl.trim()) body.pressReleaseUrl = pressReleaseUrl.trim();
      if (pressReleaseNotes.trim()) body.pressReleaseNotes = pressReleaseNotes.trim();

      if (Object.keys(body).length === 0) {
        alert('Please enter a URL or notes');
        return;
      }

      const res = await fetch(`/api/v1/admin/vetting/${vetting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to save press release data');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setSavingPressRelease(false);
    }
  }

  async function handleSaveRecommendation() {
    if (!recommendation) {
      alert('Please select a recommendation');
      return;
    }
    setSavingRec(true);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vetting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation,
          notes: recNotes || null,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to save recommendation');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setSavingRec(false);
    }
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Advance Stage */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Advance Stage
        </h3>

        <div className="mb-4">
          <p className="text-sm">
            Current stage: <span className="font-medium">{formatLabel(vetting.stage)}</span>
          </p>
          {nextStage && (
            <p className="text-sm text-muted-foreground">
              Next stage: {formatLabel(nextStage)}
            </p>
          )}
        </div>

        {/* Gate checklist */}
        {nextStage && (
          <div className="mb-4 space-y-2">
            <h4 className="text-sm font-medium">Stage Gate Checklist</h4>
            {incompleteSections.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Incomplete sections: </span>
                <span className="text-amber-600 dark:text-amber-400">
                  {incompleteSections.map(formatLabel).join(', ')}
                </span>
              </div>
            )}
            {incompleteSections.length === 0 && (
              <p className="text-sm text-green-600 dark:text-green-400">
                All sections completed
              </p>
            )}
            {nextStage === 'board_vote' && !vetting.recommendation && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Committee recommendation required before board vote
              </p>
            )}
            {nextStage === 'press_release_created' && !vetting.endorsement_result && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Board vote must be finalized before creating press release
              </p>
            )}
            {gateResult.allowed ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-transparent">
                Ready to advance
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-transparent">
                {gateResult.reason}
              </Badge>
            )}
          </div>
        )}

        {permissions.canCreateVetting && nextStage && (
          <Button
            className="bg-rlc-red hover:bg-rlc-red/90"
            onClick={handleAdvanceStage}
            disabled={advancing || !gateResult.allowed}
          >
            {advancing ? 'Advancing...' : `Advance to ${formatLabel(nextStage)}`}
          </Button>
        )}

        {!nextStage && vetting.stage !== 'press_release_published' && (
          <p className="text-sm text-muted-foreground">
            No further stage transitions available.
          </p>
        )}

        {!permissions.canCreateVetting && nextStage && (
          <p className="text-sm text-muted-foreground">
            Only the committee chair or national admin can advance stages.
          </p>
        )}
      </div>

      {/* Interview Form */}
      {permissions.canRecordInterview && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Interview
          </h3>

          <div className="space-y-3">
            <div>
              <label className={ADMIN_LABEL_CLASS}>Interview Date</label>
              <input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                className={ADMIN_INPUT_CLASS}
              />
            </div>

            <div>
              <label className={ADMIN_LABEL_CLASS}>Interviewers (comma-separated)</label>
              <input
                value={interviewers}
                onChange={(e) => setInterviewers(e.target.value)}
                className={ADMIN_INPUT_CLASS}
                placeholder="Jane Smith, John Doe"
              />
            </div>

            <div>
              <label className={ADMIN_LABEL_CLASS}>Interview Notes</label>
              <textarea
                value={interviewNotes}
                onChange={(e) => setInterviewNotes(e.target.value)}
                rows={5}
                className={ADMIN_INPUT_CLASS}
                placeholder="Interview notes and observations..."
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-rlc-red hover:bg-rlc-red/90"
                onClick={handleSaveInterview}
                disabled={savingInterview}
              >
                {savingInterview ? 'Saving...' : 'Save Interview Data'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recommendation Form */}
      {permissions.canMakeRecommendation && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Committee Recommendation
          </h3>

          {vetting.recommendation && (
            <p className="mb-3 text-sm">
              Current recommendation:{' '}
              <span className="font-medium">{formatLabel(vetting.recommendation)}</span>
              {vetting.recommended_at && (
                <span className="text-muted-foreground">
                  {' '}(submitted {new Date(vetting.recommended_at).toLocaleDateString()})
                </span>
              )}
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label className={ADMIN_LABEL_CLASS}>Recommendation</label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className={ADMIN_INPUT_CLASS}
              >
                <option value="">Select recommendation...</option>
                {VETTING_RECOMMENDATIONS.map((r) => (
                  <option key={r} value={r}>
                    {formatLabel(r)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={ADMIN_LABEL_CLASS}>Notes</label>
              <textarea
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
                rows={4}
                className={ADMIN_INPUT_CLASS}
                placeholder="Recommendation rationale..."
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-rlc-red hover:bg-rlc-red/90"
                onClick={handleSaveRecommendation}
                disabled={savingRec || !recommendation}
              >
                {savingRec ? 'Saving...' : 'Submit Recommendation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Process Complete Banner */}
      {vetting.stage === 'press_release_published' && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/30 p-6">
          <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-3">
            Vetting Complete &mdash; Press Release Published
          </h3>
          <div className="space-y-2 text-sm">
            {vetting.endorsement_result && (
              <p>
                <span className="text-muted-foreground">Endorsement Result:</span>{' '}
                <span className="font-medium">{formatLabel(vetting.endorsement_result)}</span>
              </p>
            )}
            {vetting.endorsed_at && (
              <p>
                <span className="text-muted-foreground">Endorsed:</span>{' '}
                {new Date(vetting.endorsed_at).toLocaleDateString()}
              </p>
            )}
            {vetting.press_release_post_id && (
              <p>
                <a
                  href={`/admin/posts/${vetting.press_release_post_id}`}
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  View Press Release in Admin
                </a>
              </p>
            )}
            {vetting.press_release_url && (
              <p>
                <span className="text-muted-foreground">External URL:</span>{' '}
                <a
                  href={vetting.press_release_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  {vetting.press_release_url}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Press Release — Draft Link or Manual Fallback */}
      {vetting.stage === 'press_release_created' && permissions.canCreateVetting && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Press Release
          </h3>

          {vetting.press_release_post_id ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Draft created &mdash; edit and publish to complete the vetting process.
              </p>
              <a
                href={`/admin/posts/${vetting.press_release_post_id}`}
                className="inline-flex items-center gap-2 rounded-md bg-rlc-red px-4 py-2 text-sm font-medium text-white hover:bg-rlc-red/90"
              >
                Edit Press Release Draft
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Auto-draft creation failed. Use the manual form below or create one from{' '}
                <Link href="/admin/posts/new?contentType=press_release" className="underline">
                  the press release editor
                </Link>.
              </p>
              <div>
                <label className={ADMIN_LABEL_CLASS}>Press Release URL</label>
                <input
                  type="url"
                  value={pressReleaseUrl}
                  onChange={(e) => setPressReleaseUrl(e.target.value)}
                  className={ADMIN_INPUT_CLASS}
                  placeholder="https://docs.google.com/... or published URL"
                />
              </div>
            </div>
          )}

          {/* Notes field (always shown) */}
          <div className="mt-3">
            <label className={ADMIN_LABEL_CLASS}>Internal Notes</label>
            <textarea
              value={pressReleaseNotes}
              onChange={(e) => setPressReleaseNotes(e.target.value)}
              rows={3}
              className={ADMIN_INPUT_CLASS}
              placeholder="Internal notes about the press release..."
            />
          </div>

          <div className="flex justify-end mt-3">
            <Button
              size="sm"
              className="bg-rlc-red hover:bg-rlc-red/90"
              onClick={handleSavePressRelease}
              disabled={savingPressRelease}
            >
              {savingPressRelease ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
