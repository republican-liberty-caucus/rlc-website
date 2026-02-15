import type { VettingStage, VettingSectionStatus, VettingReportSectionType, BoardVoteChoice, VettingRecommendation } from '@/types';
import { VETTING_STAGES, VETTING_REPORT_SECTION_TYPES } from '@/lib/validations/vetting';

// Ordered stage list (index = progression order)
export const STAGE_ORDER: VettingStage[] = [...VETTING_STAGES];

// Valid forward transitions — each stage maps to the stages it can move to
const STAGE_TRANSITIONS: Record<VettingStage, VettingStage[]> = {
  survey_submitted: ['auto_audit'],
  auto_audit: ['assigned'],
  assigned: ['research'],
  research: ['interview'],
  interview: ['committee_review'],
  committee_review: ['board_vote'],
  board_vote: ['press_release_created'],
  press_release_created: ['press_release_published'],
  press_release_published: [],
};

// Sections that must be completed before advancing to committee_review
const REQUIRED_SECTIONS_FOR_REVIEW: VettingReportSectionType[] = [
  'executive_summary',
  'candidate_background',
  'opponent_research',
  'district_data',
];

// Statuses that count as "done" for a section
const SECTION_DONE_STATUSES: VettingSectionStatus[] = ['section_completed'];

type SectionState = { section: VettingReportSectionType; status: VettingSectionStatus };

export function isValidStageTransition(from: VettingStage, to: VettingStage): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getStageIndex(stage: VettingStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function getNextStage(current: VettingStage): VettingStage | null {
  const transitions = STAGE_TRANSITIONS[current];
  return transitions.length > 0 ? transitions[0] : null;
}

/** Check if all required sections are completed before advancing to committee_review */
export function canAdvanceToReview(sections: SectionState[]): boolean {
  const statusMap = new Map(sections.map((s) => [s.section, s.status]));
  return REQUIRED_SECTIONS_FOR_REVIEW.every((section) => {
    const status = statusMap.get(section);
    return status && SECTION_DONE_STATUSES.includes(status);
  });
}

/** Check if a stage transition is allowed given current state */
export function canAdvanceStage(
  from: VettingStage,
  to: VettingStage,
  sections: SectionState[],
  options?: {
    hasRecommendation?: boolean;
    hasEndorsementResult?: boolean;
  }
): { allowed: boolean; reason?: string } {
  if (!isValidStageTransition(from, to)) {
    return { allowed: false, reason: `Cannot transition from ${from} to ${to}` };
  }

  // Gate: research → interview requires all required sections done
  if (to === 'interview') {
    if (!canAdvanceToReview(sections)) {
      return {
        allowed: false,
        reason: 'Required report sections must be completed before scheduling interview',
      };
    }
  }

  // Gate: committee_review → board_vote requires a recommendation
  if (to === 'board_vote') {
    if (!options?.hasRecommendation) {
      return {
        allowed: false,
        reason: 'Committee chair must submit a recommendation before board vote',
      };
    }
  }

  // Gate: board_vote → press_release_created requires finalized vote
  if (to === 'press_release_created') {
    if (!options?.hasEndorsementResult) {
      return {
        allowed: false,
        reason: 'Board vote must be finalized before creating press release',
      };
    }
  }

  return { allowed: true };
}

/** Calculate overall vetting progress as section completion percentage */
export function calculateVettingProgress(sections: SectionState[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = VETTING_REPORT_SECTION_TYPES.length;
  const completed = sections.filter((s) => SECTION_DONE_STATUSES.includes(s.status)).length;
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

/** Get all section types that still need work */
export function getIncompleteSections(sections: SectionState[]): VettingReportSectionType[] {
  const doneSet = new Set(
    sections.filter((s) => SECTION_DONE_STATUSES.includes(s.status)).map((s) => s.section)
  );
  return VETTING_REPORT_SECTION_TYPES.filter((section) => !doneSet.has(section));
}

/** Check if a section status transition is valid */
export function isValidSectionTransition(from: VettingSectionStatus, to: VettingSectionStatus): boolean {
  const transitions: Record<VettingSectionStatus, VettingSectionStatus[]> = {
    section_not_started: ['section_assigned', 'section_in_progress'],
    section_assigned: ['section_in_progress'],
    section_in_progress: ['section_completed', 'needs_revision'],
    section_completed: ['needs_revision'],
    needs_revision: ['section_in_progress'],
  };
  return transitions[from]?.includes(to) ?? false;
}

/** Initialize all report section states for a new vetting */
export function initializeSectionStates(): { section: VettingReportSectionType; status: VettingSectionStatus }[] {
  return VETTING_REPORT_SECTION_TYPES.map((section) => ({
    section,
    status: 'section_not_started' as VettingSectionStatus,
  }));
}

/** Calculate urgency based on days until primary election */
export function calculateUrgency(primaryDate: string | null): 'normal' | 'amber' | 'red' {
  if (!primaryDate) return 'normal';
  const now = new Date();
  const primary = new Date(primaryDate);
  const diffMs = primary.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 14) return 'red';
  if (diffDays < 30) return 'amber';
  return 'normal';
}

// ============================================
// Board vote tally functions
// ============================================

export interface VoteTally {
  vote_endorse: number;
  vote_do_not_endorse: number;
  vote_no_position: number;
  vote_abstain: number;
  total: number;
}

/** Count votes by choice */
export function tallyVotes(votes: { vote: BoardVoteChoice }[]): VoteTally {
  const tally: VoteTally = {
    vote_endorse: 0,
    vote_do_not_endorse: 0,
    vote_no_position: 0,
    vote_abstain: 0,
    total: votes.length,
  };
  for (const v of votes) {
    tally[v.vote]++;
  }
  return tally;
}

/** Determine endorsement result from vote tally. Plurality wins; ties default to no_position. */
export function getEndorsementResult(tally: VoteTally): VettingRecommendation {
  // Only count substantive votes (exclude abstentions)
  const counts: [VettingRecommendation, number][] = [
    ['endorse', tally.vote_endorse],
    ['do_not_endorse', tally.vote_do_not_endorse],
    ['no_position', tally.vote_no_position],
  ];

  counts.sort((a, b) => b[1] - a[1]);

  // If all votes are abstentions or no substantive votes cast, default to no_position
  if (counts[0][1] === 0) return 'no_position';

  // If there's a tie between the top two, default to no_position
  if (counts[0][1] === counts[1][1]) return 'no_position';

  return counts[0][0];
}
