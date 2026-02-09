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
  | 'chapter_officer'
  | 'chapter_admin'
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
  leadership: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contribution {
  id: string;
  member_id: string | null;
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
  member_id: string | null;
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

export interface Survey {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: SurveyStatus;
  election_type: string | null;
  election_date: string | null;
  state: string | null;
  charter_id: string | null;
  created_by: string | null;
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
  member_id: string;
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
  member_id: string;
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
