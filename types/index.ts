// Membership tiers — matches CiviCRM's 7 membership types
export type MembershipTier =
  | 'student_military'
  | 'individual'
  | 'premium'
  | 'sustaining'
  | 'patron'
  | 'benefactor'
  | 'roundtable';

// Membership statuses — matches CiviCRM's status rules
// Prisma uses "new_member" because "new" is a SQL reserved word.
// The PostgreSQL enum value is "new_member" — all layers must use this value.
export type MembershipStatus =
  | 'new_member'
  | 'current'
  | 'grace'
  | 'expired'
  | 'pending'
  | 'cancelled'
  | 'deceased'
  | 'expiring';

export type ContributionType = 'membership' | 'donation' | 'event_registration' | 'merchandise';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export type CharterLevel =
  | 'national'
  | 'multi_state_region'
  | 'state'
  | 'intra_state_region'
  | 'county';

export type CharterStatus = 'active' | 'inactive' | 'forming';

export type HouseholdRole = 'primary' | 'spouse' | 'child';

export type UserRole =
  | 'member'
  | 'charter_officer'
  | 'charter_admin'
  | 'state_chair'
  | 'regional_coordinator'
  | 'national_board'
  | 'super_admin';

// Database row types (snake_case to match Supabase)
export interface Contact {
  id: string;
  clerk_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  membership_tier: MembershipTier;
  membership_status: MembershipStatus;
  membership_start_date: string | null;
  membership_expiry_date: string | null;
  membership_join_date: string | null;
  primary_charter_id: string | null;
  highlevel_contact_id: string | null;
  civicrm_contact_id: number | null;
  stripe_customer_id: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  do_not_phone: boolean;
  household_id: string | null;
  household_role: HouseholdRole | null;
  primary_contact_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Charter {
  id: string;
  name: string;
  slug: string;
  charter_level: CharterLevel;
  parent_charter_id: string | null;
  state_code: string | null;
  region_name: string | null;
  status: CharterStatus;
  website_url: string | null;
  contact_email: string | null;
  description: string | null;
  contact_phone: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  bylaws_url: string | null;
  leadership: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contribution {
  id: string;
  contact_id: string | null;
  contribution_type: ContributionType;
  amount: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  payment_status: PaymentStatus;
  payment_method: string | null;
  charter_id: string | null;
  campaign_id: string | null;
  is_recurring: boolean;
  recurring_interval: string | null;
  civicrm_contribution_id: number | null;
  transaction_id: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  featured_image_url: string | null;
  event_type: string | null;
  start_date: string;
  end_date: string | null;
  timezone: string;
  is_virtual: boolean;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  virtual_url: string | null;
  registration_required: boolean;
  max_attendees: number | null;
  registration_fee: number | null;
  registration_deadline: string | null;
  charter_id: string | null;
  organizer_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  contact_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  registration_status: string;
  checked_in_at: string | null;
  contribution_id: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  author_id: string | null;
  charter_id: string | null;
  status: string;
  content_type: 'post' | 'page' | 'press_release';
  published_at: string | null;
  categories: string[];
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export type SurveyStatus = 'draft' | 'active' | 'closed';
export type CandidateResponseStatus = 'pending' | 'in_progress' | 'submitted' | 'endorsed' | 'not_endorsed';
export type QuestionType = 'scale' | 'yes_no' | 'text' | 'multiple_choice';
export type ElectionType = 'primary' | 'general' | 'special' | 'runoff' | 'primary_runoff';

export type QuestionCategory =
  | 'fiscal_policy' | 'constitutional_rights' | 'second_amendment'
  | 'judicial_philosophy' | 'immigration' | 'healthcare' | 'education'
  | 'foreign_policy' | 'criminal_justice' | 'regulatory_reform'
  | 'property_rights' | 'other';

export interface Survey {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: SurveyStatus;
  office_type_id: string | null;
  election_type: ElectionType | null;
  primary_date: string | null;
  general_date: string | null;
  state: string | null;
  charter_id: string | null;
  election_deadline_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionTemplate {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  weight: number;
  ideal_answer: string | null;
  sort_order: number;
  office_levels: OfficeLevel[];
  category: QuestionCategory;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  weight: number;
  sort_order: number;
  ideal_answer: string | null;
  created_at: string;
}

export interface CandidateResponse {
  id: string;
  survey_id: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_party: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  access_token: string;
  status: CandidateResponseStatus;
  total_score: number | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyAnswer {
  id: string;
  candidate_response_id: string;
  question_id: string;
  answer: string;
  score: number | null;
}

// Phase 5: Liberty Scorecard & Action Center types

export type Jurisdiction = 'federal' | 'state';
export type ScorecardSessionStatus = 'draft' | 'active' | 'published' | 'archived';
export type LibertyPosition = 'yea' | 'nay';
export type BillTrackingStatus = 'tracking' | 'voted' | 'no_vote';
export type VoteChoice = 'yea' | 'nay' | 'not_voting' | 'absent' | 'present' | 'not_applicable';
export type SponsorshipRole = 'sponsor' | 'cosponsor';
export type LegislativeChamber = 'us_house' | 'us_senate' | 'state_house' | 'state_senate';
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface Legislator {
  id: string;
  legiscan_people_id: number | null;
  name: string;
  party: string;
  chamber: LegislativeChamber;
  state_code: string;
  district: string | null;
  photo_url: string | null;
  current_score: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ScorecardSession {
  id: string;
  name: string;
  slug: string;
  jurisdiction: Jurisdiction;
  state_code: string | null;
  charter_id: string | null;
  session_year: number;
  status: ScorecardSessionStatus;
  description: string | null;
  chamber: LegislativeChamber | null;
  party_filter: string | null;
  absence_penalty_threshold: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScorecardBill {
  id: string;
  session_id: string;
  legiscan_bill_id: number | null;
  bill_number: string;
  title: string;
  description: string | null;
  liberty_position: LibertyPosition;
  ai_suggested_position: LibertyPosition | null;
  ai_analysis: string | null;
  category: string;
  weight: number;
  vote_date: string | null;
  bill_status: BillTrackingStatus;
  legiscan_roll_call_id: number | null;
  sort_order: number;
  is_bonus: boolean;
  bonus_point_value: number;
  vote_result_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScorecardVote {
  id: string;
  bill_id: string;
  legislator_id: string;
  vote: VoteChoice;
  aligned_with_liberty: boolean;
  sponsorship_role: SponsorshipRole | null;
  created_at: string;
}

export type ScoredLegislator = Legislator & { computed_score: number | null };

export interface ScorecardLegislatorScore {
  id: string;
  session_id: string;
  legislator_id: string;
  votes_aligned: number;
  total_bills: number;
  absences: number;
  bonus_points: number;
  liberty_score: number;
  created_at: string;
  updated_at: string;
}

export interface ActionCampaign {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  bill_id: string | null;
  charter_id: string | null;
  target_chamber: LegislativeChamber | null;
  target_state_code: string | null;
  message_template: string | null;
  status: CampaignStatus;
  created_by: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignParticipation {
  id: string;
  campaign_id: string;
  contact_id: string;
  action: string;
  legislator_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Dues Sharing types

export type DisbursementModel = 'national_managed' | 'state_managed';
export type StripeConnectStatus = 'not_started' | 'onboarding' | 'active' | 'disabled';
export type SplitLedgerStatus = 'pending' | 'transferred' | 'reversed' | 'failed';
export type SplitSourceType = 'membership' | 'donation' | 'event_registration';

export interface CharterStripeAccount {
  id: string;
  charter_id: string;
  stripe_account_id: string;
  status: StripeConnectStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharterSplitConfig {
  id: string;
  charter_id: string;
  disbursement_model: DisbursementModel;
  is_active: boolean;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharterSplitRule {
  id: string;
  config_id: string;
  recipient_charter_id: string;
  percentage: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SplitLedgerEntry {
  id: string;
  contribution_id: string;
  source_type: SplitSourceType;
  recipient_charter_id: string;
  amount: number;
  currency: string;
  status: SplitLedgerStatus;
  stripe_transfer_id: string | null;
  stripe_transfer_group_id: string | null;
  transferred_at: string | null;
  reversal_of_id: string | null;
  split_rule_snapshot: Record<string, unknown>;
  created_at: string;
}

// Officer Position & Charter Onboarding types

export type OfficerTitle =
  | 'chair'
  | 'vice_chair'
  | 'secretary'
  | 'treasurer'
  | 'at_large_board'
  | 'committee_chair'
  | 'committee_member'
  | 'state_coordinator'
  | 'regional_director';

export type OnboardingStepStatus = 'not_started' | 'in_progress' | 'completed' | 'approved' | 'rejected';

export type OnboardingStep =
  | 'coordinator_membership'
  | 'coordinator_appointment'
  | 'recruit_members'
  | 'template_bylaws'
  | 'organizational_meeting'
  | 'submit_documents'
  | 'legal_entity'
  | 'stripe_connect';

export interface OfficerPosition {
  id: string;
  contact_id: string;
  charter_id: string;
  title: OfficerTitle;
  committee_name: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  appointed_by_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharterOnboarding {
  id: string;
  charter_id: string;
  coordinator_id: string;
  current_step: OnboardingStep;
  started_at: string;
  completed_at: string | null;
  approved_at: string | null;
  approved_by_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CharterOnboardingStep {
  id: string;
  onboarding_id: string;
  step: OnboardingStep;
  status: OnboardingStepStatus;
  data: Record<string, unknown>;
  completed_at: string | null;
  completed_by_id: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Candidate Vetting types

export type VettingStage =
  | 'survey_submitted'
  | 'auto_audit'
  | 'assigned'
  | 'research'
  | 'interview'
  | 'committee_review'
  | 'board_vote'
  | 'press_release_created'
  | 'press_release_published';

export type VettingReportSectionType =
  | 'digital_presence_audit'
  | 'executive_summary'
  | 'election_schedule'
  | 'voting_rules'
  | 'candidate_background'
  | 'incumbent_record'
  | 'opponent_research'
  | 'electoral_results'
  | 'district_data';

export type AuditStatus = 'audit_pending' | 'running' | 'audit_completed' | 'audit_failed';
export type VettingRecommendation = 'endorse' | 'do_not_endorse' | 'no_position';
export type VettingSectionStatus = 'section_not_started' | 'section_assigned' | 'section_in_progress' | 'section_completed' | 'needs_revision';
export type BoardVoteChoice = 'vote_endorse' | 'vote_do_not_endorse' | 'vote_no_position' | 'vote_abstain';
export type CommitteeRole = 'chair' | 'committee_member';

export type OfficeLevel = 'federal' | 'state' | 'county' | 'municipal' | 'judicial' | 'special_district';

export interface OfficeType {
  id: string;
  level: OfficeLevel;
  name: string;
  slug: string;
  endorsing_charter_level: CharterLevel;
  requires_state: boolean;
  requires_district: boolean;
  requires_county: boolean;
  district_label: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CandidateVettingCommittee {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CandidateVettingCommitteeMember {
  id: string;
  committee_id: string;
  contact_id: string;
  role: CommitteeRole;
  is_active: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateVetting {
  id: string;
  candidate_response_id: string;
  committee_id: string | null;
  stage: VettingStage;
  candidate_name: string;
  candidate_office: string | null;
  candidate_district: string | null;
  candidate_state: string | null;
  candidate_party: string | null;
  office_type_id: string | null;
  charter_id: string | null;
  election_deadline_id: string | null;
  district_data_id: string | null;
  interview_date: string | null;
  interview_notes: string | null;
  interviewers: string[];
  recommendation: VettingRecommendation | null;
  recommendation_notes: string | null;
  recommended_at: string | null;
  endorsement_result: VettingRecommendation | null;
  endorsed_at: string | null;
  press_release_url: string | null;
  press_release_notes: string | null;
  press_release_post_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CandidateVettingReportSection {
  id: string;
  vetting_id: string;
  section: VettingReportSectionType;
  status: VettingSectionStatus;
  data: Record<string, unknown>;
  ai_draft_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateVettingSectionAssignment {
  id: string;
  section_id: string;
  committee_member_id: string;
  assigned_by_id: string | null;
  assigned_at: string;
}

export interface CandidateVettingOpponent {
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

export interface CandidateVettingBoardVote {
  id: string;
  vetting_id: string;
  voter_id: string;
  vote: BoardVoteChoice;
  notes: string | null;
  voted_at: string;
}

export interface CandidateElectionDeadline {
  id: string;
  state_code: string;
  cycle_year: number;
  office_type: string;
  primary_date: string | null;
  primary_runoff_date: string | null;
  general_date: string | null;
  general_runoff_date: string | null;
  filing_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateDistrictData {
  id: string;
  state_code: string;
  district_id: string;
  office_type: string;
  cook_pvi: string | null;
  population: number | null;
  party_registration: Record<string, unknown> | null;
  municipalities: string[];
  counties: string[];
  overlapping_districts: string[];
  electoral_history: Record<string, unknown> | null;
  map_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CandidateDigitalAudit {
  id: string;
  vetting_id: string;
  status: AuditStatus;
  started_at: string | null;
  completed_at: string | null;
  triggered_by_id: string | null;
  candidate_overall_score: number | null;
  candidate_grade: string | null;
  candidate_score_breakdown: Record<string, unknown> | null;
  candidate_risks: Record<string, unknown>[] | null;
  opponent_audits: Record<string, unknown>[] | null;
  discovery_log: Record<string, unknown> | null;
  screenshots_manifest: Record<string, unknown> | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CandidateAuditPlatform {
  id: string;
  audit_id: string;
  entity_type: string;
  entity_name: string;
  platform_name: string;
  platform_url: string | null;
  confidence_score: number | null;
  discovery_method: string | null;
  activity_status: string | null;
  last_activity_date: string | null;
  followers: number | null;
  engagement_rate: number | null;
  screenshot_desktop_url: string | null;
  screenshot_mobile_url: string | null;
  score_presence: number | null;
  score_consistency: number | null;
  score_quality: number | null;
  score_accessibility: number | null;
  total_score: number | null;
  grade: string | null;
  contact_methods: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Share Kit types

export type ShareKitContentType = 'endorsement' | 'campaign' | 'event' | 'custom';
export type ShareKitStatus = 'draft' | 'active' | 'archived';
export type ShareKitScope = 'national' | 'charter';
export type SharePlatform = 'x' | 'facebook' | 'linkedin' | 'email' | 'sms' | 'copy' | 'qr';

export interface SocialCopyVariant {
  formal: string;
  casual: string;
  punchy: string;
}

export interface SocialCopyVariants {
  x: SocialCopyVariant;
  facebook: SocialCopyVariant;
  linkedin: SocialCopyVariant;
}

export interface ShareKit {
  id: string;
  content_type: ShareKitContentType;
  content_id: string;
  title: string;
  description: string | null;
  social_copy: SocialCopyVariants;
  og_image_url: string | null;
  og_image_override_url: string | null;
  status: ShareKitStatus;
  scope: ShareKitScope;
  charter_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  share_kit_id: string;
  member_id: string;
  short_code: string;
  created_at: string;
}

export interface LinkClick {
  id: string;
  share_link_id: string;
  clicked_at: string;
  referrer: string | null;
  user_agent: string | null;
  geo_state: string | null;
}

export interface ShareEvent {
  id: string;
  share_link_id: string;
  platform: SharePlatform;
  shared_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
