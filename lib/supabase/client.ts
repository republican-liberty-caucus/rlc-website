import { createClient } from '@supabase/supabase-js';
import type {
  MembershipTier,
  MembershipStatus,
  ContributionType,
  PaymentStatus,
  CharterLevel,
  CharterStatus,
  HouseholdRole,
  UserRole,
  Jurisdiction,
  ScorecardSessionStatus,
  LibertyPosition,
  BillTrackingStatus,
  VoteChoice,
  LegislativeChamber,
  CampaignStatus,
  VettingStage,
  VettingReportSectionType,
  AuditStatus,
  VettingRecommendation,
  VettingSectionStatus,
  BoardVoteChoice,
  CommitteeRole,
} from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type exports for database
export type Database = {
  public: {
    Tables: {
      rlc_charters: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_charters']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_charters']['Insert']>;
      };
      rlc_members: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_members']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_members']['Insert']>;
      };
      rlc_member_roles: {
        Row: {
          id: string;
          member_id: string;
          role: UserRole;
          charter_id: string | null;
          granted_by: string | null;
          granted_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['rlc_member_roles']['Row'], 'id' | 'granted_at'>;
        Update: Partial<Database['public']['Tables']['rlc_member_roles']['Insert']>;
      };
      rlc_contributions: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_contributions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['rlc_contributions']['Insert']>;
      };
      rlc_events: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
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
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_events']['Insert']>;
      };
      rlc_event_registrations: {
        Row: {
          id: string;
          event_id: string;
          member_id: string | null;
          guest_email: string | null;
          guest_name: string | null;
          registration_status: string;
          checked_in_at: string | null;
          contribution_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_event_registrations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['rlc_event_registrations']['Insert']>;
      };
      rlc_posts: {
        Row: {
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
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_posts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_posts']['Insert']>;
      };
      rlc_highlevel_sync_log: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          highlevel_id: string | null;
          action: string;
          status: string;
          error_message: string | null;
          request_payload: Record<string, unknown> | null;
          response_payload: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_highlevel_sync_log']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['rlc_highlevel_sync_log']['Insert']>;
      };
      rlc_legislators: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_legislators']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_legislators']['Insert']>;
      };
      rlc_scorecard_sessions: {
        Row: {
          id: string;
          name: string;
          slug: string;
          jurisdiction: Jurisdiction;
          state_code: string | null;
          charter_id: string | null;
          session_year: number;
          status: ScorecardSessionStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_scorecard_sessions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_scorecard_sessions']['Insert']>;
      };
      rlc_scorecard_bills: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_scorecard_bills']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_scorecard_bills']['Insert']>;
      };
      rlc_scorecard_votes: {
        Row: {
          id: string;
          bill_id: string;
          legislator_id: string;
          vote: VoteChoice;
          aligned_with_liberty: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_scorecard_votes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['rlc_scorecard_votes']['Insert']>;
      };
      rlc_action_campaigns: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_action_campaigns']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_action_campaigns']['Insert']>;
      };
      rlc_campaign_participations: {
        Row: {
          id: string;
          campaign_id: string;
          member_id: string;
          action: string;
          legislator_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_campaign_participations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['rlc_campaign_participations']['Insert']>;
      };
      rlc_candidate_vetting_committees: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_vetting_committees']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_vetting_committees']['Insert']>;
      };
      rlc_candidate_vetting_committee_members: {
        Row: {
          id: string;
          committee_id: string;
          contact_id: string;
          role: CommitteeRole;
          is_active: boolean;
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_vetting_committee_members']['Row'], 'id' | 'created_at' | 'updated_at' | 'joined_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_vetting_committee_members']['Insert']>;
      };
      rlc_candidate_vettings: {
        Row: {
          id: string;
          candidate_response_id: string;
          committee_id: string | null;
          stage: VettingStage;
          candidate_name: string;
          candidate_office: string | null;
          candidate_district: string | null;
          candidate_state: string | null;
          candidate_party: string | null;
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
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_vettings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_vettings']['Insert']>;
      };
      rlc_candidate_vetting_report_sections: {
        Row: {
          id: string;
          vetting_id: string;
          section: VettingReportSectionType;
          status: VettingSectionStatus;
          data: Record<string, unknown>;
          ai_draft_data: Record<string, unknown> | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_vetting_report_sections']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_vetting_report_sections']['Insert']>;
      };
      rlc_candidate_vetting_section_assignments: {
        Row: {
          id: string;
          section_id: string;
          committee_member_id: string;
          assigned_by_id: string | null;
          assigned_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_vetting_section_assignments']['Row'], 'id' | 'assigned_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_vetting_section_assignments']['Insert']>;
      };
      rlc_candidate_vetting_opponents: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_vetting_opponents']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_vetting_opponents']['Insert']>;
      };
      rlc_candidate_vetting_board_votes: {
        Row: {
          id: string;
          vetting_id: string;
          voter_id: string;
          vote: BoardVoteChoice;
          notes: string | null;
          voted_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_vetting_board_votes']['Row'], 'id' | 'voted_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_vetting_board_votes']['Insert']>;
      };
      rlc_candidate_election_deadlines: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_election_deadlines']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_election_deadlines']['Insert']>;
      };
      rlc_candidate_district_data: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_district_data']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_district_data']['Insert']>;
      };
      rlc_candidate_digital_audits: {
        Row: {
          id: string;
          vetting_id: string;
          status: AuditStatus;
          started_at: string | null;
          completed_at: string | null;
          triggered_by_id: string | null;
          candidate_overall_score: number | null;
          candidate_grade: string | null;
          candidate_score_breakdown: Record<string, unknown> | null;
          candidate_risks: Record<string, unknown> | null;
          opponent_audits: Record<string, unknown> | null;
          discovery_log: Record<string, unknown> | null;
          screenshots_manifest: Record<string, unknown> | null;
          error_message: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_digital_audits']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_digital_audits']['Insert']>;
      };
      rlc_candidate_audit_platforms: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['rlc_candidate_audit_platforms']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['rlc_candidate_audit_platforms']['Insert']>;
      };
    };
  };
};
