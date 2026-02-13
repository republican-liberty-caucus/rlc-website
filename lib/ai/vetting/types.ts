import type { VettingReportSectionType } from '@/types';

// ============================================
// Opponent Research
// ============================================

export interface OpponentResearchInput {
  opponentName: string;
  party: string | null;
  state: string | null;
  office: string | null;
  district: string | null;
}

export interface OpponentResearchOutput {
  background: string;
  experience: string;
  fundraising: {
    estimatedTotal: string;
    sources: string[];
  };
  strengths: string[];
  weaknesses: string[];
  keyIssues: string[];
  endorsements: string[];
}

// ============================================
// District Research
// ============================================

export interface DistrictResearchInput {
  stateCode: string;
  districtId: string;
  officeType: string;
}

export interface DistrictResearchOutput {
  cookPvi: string;
  demographics: {
    population: number | null;
    medianAge: number | null;
    medianIncome: number | null;
    raceEthnicity: Record<string, number>;
  };
  voterRegistration: {
    republican: number | null;
    democrat: number | null;
    independent: number | null;
    other: number | null;
  };
  electoralHistory: {
    year: number;
    winner: string;
    party: string;
    margin: string;
  }[];
  keyIssues: string[];
  geographicNotes: string;
}

// ============================================
// Voting Rules Research
// ============================================

export interface VotingRulesResearchInput {
  stateCode: string;
}

export interface VotingRulesResearchOutput {
  voterEligibility: string;
  registrationRules: {
    deadline: string;
    onlineAvailable: boolean;
    sameDay: boolean;
  };
  absenteeRules: {
    noExcuseRequired: boolean;
    earlyVotingDays: number | null;
    mailBallotDeadline: string;
  };
  primaryType: string;
  runoffRules: string;
  keyDates: {
    event: string;
    date: string;
  }[];
}

// ============================================
// Candidate Background Draft
// ============================================

export interface CandidateBackgroundInput {
  candidateName: string;
  office: string | null;
  state: string | null;
  district: string | null;
  party: string | null;
  surveyAnswers?: { question: string; answer: string }[];
}

export interface CandidateBackgroundOutput {
  employment: string;
  education: string;
  politicalExperience: string;
  communityInvolvement: string;
  keyPositions: string[];
  notableAchievements: string[];
}

// ============================================
// Executive Summary
// ============================================

export interface ExecutiveSummaryInput {
  candidateName: string;
  office: string | null;
  state: string | null;
  party: string | null;
  allSectionData: Record<string, Record<string, unknown> | null>;
}

export interface ExecutiveSummaryOutput {
  summary: string;
  overallAssessment: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
}

// ============================================
// Section-to-helper mapping
// ============================================

/** Section types that have AI draft helpers */
export const SECTIONS_WITH_AI_HELPER: VettingReportSectionType[] = [
  'opponent_research',
  'district_data',
  'voting_rules',
  'candidate_background',
  'executive_summary',
];
