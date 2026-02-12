'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_INPUT_CLASS, ADMIN_LABEL_CLASS } from '@/components/admin/form-styles';
import { BOARD_VOTE_CHOICES } from '@/lib/validations/vetting';
import { tallyVotes } from '@/lib/vetting/engine';
import type { VettingFullData, VettingPermissions, BoardVoteData, EligibleVoter } from '../types';
import type { BoardVoteChoice } from '@/types';

function formatLabel(value: string): string {
  return value
    .replace(/^vote_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const VOTE_COLORS: Record<BoardVoteChoice, string> = {
  vote_endorse: 'bg-green-500',
  vote_do_not_endorse: 'bg-red-500',
  vote_no_position: 'bg-gray-400',
  vote_abstain: 'bg-amber-400',
};

const VOTE_BADGE_STYLES: Record<BoardVoteChoice, string> = {
  vote_endorse: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-transparent',
  vote_do_not_endorse: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-transparent',
  vote_no_position: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-transparent',
  vote_abstain: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-transparent',
};

const RESULT_BADGE_STYLES: Record<string, string> = {
  endorse: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-transparent',
  do_not_endorse: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-transparent',
  no_position: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-transparent',
};

interface VettingBoardVoteTabProps {
  vetting: VettingFullData;
  permissions: VettingPermissions;
}

export function VettingBoardVoteTab({ vetting, permissions }: VettingBoardVoteTabProps) {
  const router = useRouter();
  const [votes, setVotes] = useState<BoardVoteData[]>([]);
  const [eligibleVoters, setEligibleVoters] = useState<EligibleVoter[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  // Cast vote form state
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [voteNotes, setVoteNotes] = useState('');

  const isFinalized = !!vetting.endorsed_at;

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vetting.id}/votes`);
      if (res.ok) {
        const data = await res.json();
        setVotes(data.votes ?? []);
        setEligibleVoters(data.eligibleVoters ?? []);
      }
    } catch {
      // Silently fail — user can retry by refreshing
    } finally {
      setLoading(false);
    }
  }, [vetting.id]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  // Compute tally from loaded votes
  const tally = tallyVotes(votes);

  const substantiveTotal = tally.vote_endorse + tally.vote_do_not_endorse + tally.vote_no_position;

  async function handleCastVote() {
    if (!selectedVote) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vetting.id}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: selectedVote, notes: voteNotes || null }),
      });
      if (res.ok) {
        setSelectedVote('');
        setVoteNotes('');
        await fetchVotes();
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to cast vote');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/v1/admin/vetting/${vetting.id}/votes/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setConfirmFinalize(false);
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || 'Failed to finalize votes');
      }
    } catch {
      alert('A network error occurred. Please check your connection and try again.');
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-4 p-6 text-center text-sm text-muted-foreground">
        Loading board vote data...
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Endorsement Result Banner */}
      {isFinalized && vetting.endorsement_result && (
        <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 p-6 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-2">Board Decision</p>
          <Badge className={`text-base px-4 py-1 ${RESULT_BADGE_STYLES[vetting.endorsement_result] ?? ''}`}>
            {formatLabel(vetting.endorsement_result)}
          </Badge>
          {vetting.endorsed_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Finalized {new Date(vetting.endorsed_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Vote Tally */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Vote Tally
        </h3>

        {tally.total === 0 ? (
          <p className="text-sm text-muted-foreground">No votes cast yet.</p>
        ) : (
          <div className="space-y-3">
            {(
              [
                ['vote_endorse', 'Endorse', tally.vote_endorse],
                ['vote_do_not_endorse', 'Do Not Endorse', tally.vote_do_not_endorse],
                ['vote_no_position', 'No Position', tally.vote_no_position],
                ['vote_abstain', 'Abstain', tally.vote_abstain],
              ] as [BoardVoteChoice, string, number][]
            ).map(([choice, label, count]) => (
              <div key={choice}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{label}</span>
                  <span className="font-medium">
                    {count} {count === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${VOTE_COLORS[choice]}`}
                    style={{ width: tally.total > 0 ? `${(count / tally.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              {tally.total} total {tally.total === 1 ? 'vote' : 'votes'} cast
              ({substantiveTotal} substantive, {tally.vote_abstain} abstentions)
            </p>
          </div>
        )}
      </div>

      {/* Board Members Grid */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Board Members
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {eligibleVoters.map((voter) => {
            const voterVote = votes.find((v) => v.voter_id === voter.id);
            return (
              <div
                key={voter.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="text-sm font-medium">
                  {voter.first_name} {voter.last_name}
                </span>
                {voterVote ? (
                  <Badge className={VOTE_BADGE_STYLES[voterVote.vote]}>
                    {formatLabel(voterVote.vote)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Pending
                  </Badge>
                )}
              </div>
            );
          })}
          {eligibleVoters.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2">
              No eligible voters found. National board or super admin roles are required to vote.
            </p>
          )}
        </div>
      </div>

      {/* Cast Vote Form */}
      {permissions.canCastBoardVote && !isFinalized && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Cast Your Vote
          </h3>

          {vetting.recommendation && (
            <p className="mb-4 text-sm text-muted-foreground">
              Committee recommendation:{' '}
              <span className="font-medium text-foreground">{formatLabel(vetting.recommendation)}</span>
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label className={ADMIN_LABEL_CLASS}>Your Vote</label>
              <div className="space-y-2">
                {BOARD_VOTE_CHOICES.map((choice) => (
                  <label key={choice} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boardVote"
                      value={choice}
                      checked={selectedVote === choice}
                      onChange={(e) => setSelectedVote(e.target.value)}
                      className="accent-rlc-red"
                    />
                    <span className="text-sm">{formatLabel(choice)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={ADMIN_LABEL_CLASS}>Notes (optional)</label>
              <textarea
                value={voteNotes}
                onChange={(e) => setVoteNotes(e.target.value)}
                rows={3}
                className={ADMIN_INPUT_CLASS}
                placeholder="Any notes on your vote..."
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-rlc-red hover:bg-rlc-red/90"
                onClick={handleCastVote}
                disabled={submitting || !selectedVote}
              >
                {submitting ? 'Submitting...' : 'Submit Vote'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Button */}
      {permissions.canCastBoardVote && !isFinalized && tally.total > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Finalize Vote
          </h3>

          {substantiveTotal === 0 ? (
            <p className="text-sm text-muted-foreground">
              At least one non-abstain vote is required before finalizing.
            </p>
          ) : !confirmFinalize ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Finalizing will lock the vote and record the endorsement result. This cannot be undone.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmFinalize(true)}
              >
                Finalize Board Vote
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Are you sure? This will permanently record the board&apos;s endorsement decision.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-rlc-red hover:bg-rlc-red/90"
                  onClick={handleFinalize}
                  disabled={finalizing}
                >
                  {finalizing ? 'Finalizing...' : 'Confirm Finalize'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmFinalize(false)}
                  disabled={finalizing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Read-only message for non-voters */}
      {!permissions.canCastBoardVote && !isFinalized && (
        <p className="text-sm text-muted-foreground text-center">
          Only national board members and super admins can cast votes.
        </p>
      )}
    </div>
  );
}
