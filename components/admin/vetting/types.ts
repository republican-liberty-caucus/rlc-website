import type {
  VettingStage,
  VettingReportSectionType,
  VettingSectionStatus,
  VettingRecommendation,
  BoardVoteChoice,
  OfficeLevel,
} from '@/types';

export interface VettingPermissions {
  canCreateVetting: boolean;
  canAssignSections: boolean;
  canEditAnySection: boolean;
  canRecordInterview: boolean;
  canMakeRecommendation: boolean;
  canCastBoardVote: boolean;
  isCommitteeMember: boolean;
  isChair: boolean;
  isNational: boolean;
  committeeMemberId: string | null;
}

export interface AssignmentMember {
  id: string;
  role: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface SectionAssignment {
  id: string;
  section_id: string;
  committee_member_id: string;
  assigned_by_id: string | null;
  assigned_at: string;
  committee_member: AssignmentMember | null;
}

export interface ReportSectionWithAssignments {
  id: string;
  vetting_id: string;
  section: VettingReportSectionType;
  status: VettingSectionStatus;
  data: Record<string, unknown> | null;
  ai_draft_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assignments: SectionAssignment[];
}

export interface CommitteeMemberOption {
  id: string;
  contact_id: string;
  role: string;
  is_active: boolean;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface OpponentData {
  id: string;
  vetting_id: string;
  name: string;
  party: string | null;
  is_incumbent: boolean;
  background: string | null;
  credibility: string | null;
  fundraising: Record<string, unknown> | null;
  endorsements: string[];
  social_links: Record<string, unknown> | null;
  photo_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BoardVoteData {
  id: string;
  vetting_id: string;
  voter_id: string;
  vote: BoardVoteChoice;
  notes: string | null;
  voted_at: string;
  voter: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface EligibleVoter {
  id: string;
  first_name: string;
  last_name: string;
}

export interface SurveyAnswerData {
  id: string;
  answer: string;
  score: number | null;
  question: {
    question_text: string;
    question_type: string;
    options: string[];
    weight: number;
    sort_order: number;
    ideal_answer: string | null;
  };
}

export interface SurveyResponseData {
  id: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_party: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  total_score: number | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
  survey: {
    title: string;
    election_type: string | null;
    election_date: string | null;
    state: string | null;
  } | null;
  answers: SurveyAnswerData[];
}

export interface OfficeTypeData {
  id: string;
  level: OfficeLevel;
  name: string;
  slug: string;
  district_label: string | null;
}

export interface VettingFullData {
  id: string;
  candidate_response_id: string;
  candidate_name: string;
  candidate_state: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  candidate_party: string | null;
  office_type_id: string | null;
  office_type: OfficeTypeData | null;
  charter_id: string | null;
  stage: VettingStage;
  recommendation: VettingRecommendation | null;
  recommendation_notes: string | null;
  recommended_at: string | null;
  endorsement_result: VettingRecommendation | null;
  endorsed_at: string | null;
  press_release_url: string | null;
  press_release_notes: string | null;
  press_release_post_id: string | null;
  interview_date: string | null;
  interview_notes: string | null;
  interviewers: string[] | null;
  created_at: string;
  updated_at: string;
  election_deadline: {
    id: string;
    primary_date: string | null;
    general_date: string | null;
    state_code: string | null;
    cycle_year: number | null;
    office_type: string | null;
  } | null;
  committee: {
    id: string;
    name: string;
  } | null;
  report_sections: ReportSectionWithAssignments[];
  opponents: OpponentData[];
}
