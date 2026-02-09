-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('student_military', 'individual', 'premium', 'sustaining', 'patron', 'benefactor', 'roundtable');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('new_member', 'current', 'grace', 'expired', 'pending', 'cancelled', 'deceased', 'expiring');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('membership', 'donation', 'event_registration', 'merchandise');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "ChapterLevel" AS ENUM ('national', 'multi_state_region', 'state', 'intra_state_region', 'county');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('active', 'inactive', 'forming');

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('primary', 'spouse', 'child');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('member', 'chapter_officer', 'chapter_admin', 'state_chair', 'regional_coordinator', 'national_board', 'super_admin');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'active', 'closed');

-- CreateEnum
CREATE TYPE "CandidateResponseStatus" AS ENUM ('pending', 'in_progress', 'submitted', 'endorsed', 'not_endorsed');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('scale', 'yes_no', 'text', 'multiple_choice');

-- CreateEnum
CREATE TYPE "Jurisdiction" AS ENUM ('federal', 'state');

-- CreateEnum
CREATE TYPE "ScorecardSessionStatus" AS ENUM ('draft', 'active', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LibertyPosition" AS ENUM ('yea', 'nay');

-- CreateEnum
CREATE TYPE "BillTrackingStatus" AS ENUM ('tracking', 'voted', 'no_vote');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('yea', 'nay', 'not_voting', 'absent');

-- CreateEnum
CREATE TYPE "LegislativeChamber" AS ENUM ('us_house', 'us_senate', 'state_house', 'state_senate');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "DisbursementModel" AS ENUM ('national_managed', 'state_managed');

-- CreateEnum
CREATE TYPE "StripeConnectStatus" AS ENUM ('not_started', 'onboarding', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "SplitLedgerStatus" AS ENUM ('pending', 'transferred', 'reversed', 'failed');

-- CreateEnum
CREATE TYPE "SplitSourceType" AS ENUM ('membership', 'donation', 'event_registration');

-- CreateTable
CREATE TABLE "rlc_chapters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "chapter_level" "ChapterLevel" NOT NULL,
    "parent_chapter_id" TEXT,
    "state_code" CHAR(2),
    "region_name" TEXT,
    "status" "ChapterStatus" NOT NULL DEFAULT 'active',
    "website_url" TEXT,
    "contact_email" TEXT,
    "leadership" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_members" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT,
    "email" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "membership_tier" "MembershipTier" NOT NULL DEFAULT 'individual',
    "membership_status" "MembershipStatus" NOT NULL DEFAULT 'pending',
    "membership_start_date" TIMESTAMP(3),
    "membership_expiry_date" TIMESTAMP(3),
    "membership_join_date" TIMESTAMP(3),
    "primary_chapter_id" TEXT,
    "highlevel_contact_id" TEXT,
    "civicrm_contact_id" INTEGER,
    "stripe_customer_id" TEXT,
    "email_opt_in" BOOLEAN NOT NULL DEFAULT true,
    "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "do_not_phone" BOOLEAN NOT NULL DEFAULT false,
    "email_validated_at" TIMESTAMP(3),
    "email_status" TEXT,
    "email_overall_score" INTEGER,
    "email_is_safe_to_send" BOOLEAN,
    "email_is_valid_syntax" BOOLEAN,
    "email_is_disposable" BOOLEAN,
    "email_is_role_account" BOOLEAN,
    "email_is_spamtrap" BOOLEAN,
    "email_is_free_email" BOOLEAN,
    "email_is_deliverable" BOOLEAN,
    "email_is_catch_all" BOOLEAN,
    "email_mx_accepts_mail" BOOLEAN,
    "household_id" TEXT,
    "household_role" "HouseholdRole",
    "primary_member_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_member_roles" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "chapter_id" TEXT,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "rlc_member_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_contributions" (
    "id" TEXT NOT NULL,
    "member_id" TEXT,
    "contribution_type" "ContributionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripe_payment_intent_id" TEXT,
    "stripe_subscription_id" TEXT,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_method" TEXT,
    "chapter_id" TEXT,
    "campaign_id" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_interval" TEXT,
    "civicrm_contribution_id" INTEGER,
    "transaction_id" TEXT,
    "source" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "is_virtual" BOOLEAN NOT NULL DEFAULT false,
    "location_name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "virtual_url" TEXT,
    "registration_required" BOOLEAN NOT NULL DEFAULT true,
    "max_attendees" INTEGER,
    "registration_fee" DECIMAL(10,2),
    "registration_deadline" TIMESTAMP(3),
    "chapter_id" TEXT,
    "organizer_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_event_registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "member_id" TEXT,
    "guest_email" TEXT,
    "guest_name" TEXT,
    "registration_status" TEXT NOT NULL DEFAULT 'registered',
    "checked_in_at" TIMESTAMP(3),
    "contribution_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT,
    "excerpt" TEXT,
    "featured_image_url" TEXT,
    "author_id" TEXT,
    "chapter_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "categories" TEXT[],
    "tags" TEXT[],
    "seo_title" TEXT,
    "seo_description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_highlevel_sync_log" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "highlevel_id" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_highlevel_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_civicrm_migration_log" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "civicrm_id" INTEGER NOT NULL,
    "supabase_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "migrated_at" TIMESTAMP(3),

    CONSTRAINT "rlc_civicrm_migration_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_surveys" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'draft',
    "election_type" TEXT,
    "election_date" TEXT,
    "state" TEXT,
    "chapter_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_survey_questions" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "options" TEXT[],
    "weight" DECIMAL(3,1) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "ideal_answer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_responses" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "candidate_email" TEXT,
    "candidate_party" TEXT,
    "candidate_office" TEXT,
    "candidate_district" TEXT,
    "access_token" TEXT NOT NULL,
    "status" "CandidateResponseStatus" NOT NULL DEFAULT 'pending',
    "total_score" DECIMAL(5,2),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_survey_answers" (
    "id" TEXT NOT NULL,
    "candidate_response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" DECIMAL(5,2),

    CONSTRAINT "rlc_survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_legislators" (
    "id" TEXT NOT NULL,
    "legiscan_people_id" INTEGER,
    "name" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "chamber" "LegislativeChamber" NOT NULL,
    "state_code" TEXT NOT NULL,
    "district" TEXT,
    "photo_url" TEXT,
    "current_score" DECIMAL(5,2),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_legislators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_scorecard_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL DEFAULT 'federal',
    "state_code" TEXT,
    "chapter_id" TEXT,
    "session_year" INTEGER NOT NULL,
    "status" "ScorecardSessionStatus" NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_scorecard_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_scorecard_bills" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "legiscan_bill_id" INTEGER,
    "bill_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "liberty_position" "LibertyPosition" NOT NULL,
    "ai_suggested_position" "LibertyPosition",
    "ai_analysis" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "weight" DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    "vote_date" DATE,
    "bill_status" "BillTrackingStatus" NOT NULL DEFAULT 'tracking',
    "legiscan_roll_call_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_scorecard_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_scorecard_votes" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "legislator_id" TEXT NOT NULL,
    "vote" "VoteChoice" NOT NULL,
    "aligned_with_liberty" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_scorecard_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_action_campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bill_id" TEXT,
    "chapter_id" TEXT,
    "target_chamber" "LegislativeChamber",
    "target_state_code" TEXT,
    "message_template" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_action_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_campaign_participations" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "legislator_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_campaign_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_chapter_stripe_accounts" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "stripe_account_id" TEXT NOT NULL,
    "status" "StripeConnectStatus" NOT NULL DEFAULT 'not_started',
    "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_chapter_stripe_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_chapter_split_configs" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "disbursement_model" "DisbursementModel" NOT NULL DEFAULT 'national_managed',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_chapter_split_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_chapter_split_rules" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "recipient_chapter_id" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_chapter_split_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_split_ledger_entries" (
    "id" TEXT NOT NULL,
    "contribution_id" TEXT NOT NULL,
    "source_type" "SplitSourceType" NOT NULL,
    "recipient_chapter_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "SplitLedgerStatus" NOT NULL DEFAULT 'pending',
    "stripe_transfer_id" TEXT,
    "stripe_transfer_group_id" TEXT,
    "transferred_at" TIMESTAMP(3),
    "reversal_of_id" TEXT,
    "split_rule_snapshot" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_split_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rlc_chapters_slug_key" ON "rlc_chapters"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_members_clerk_user_id_key" ON "rlc_members"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_members_email_key" ON "rlc_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_members_highlevel_contact_id_key" ON "rlc_members"("highlevel_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_members_civicrm_contact_id_key" ON "rlc_members"("civicrm_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_members_stripe_customer_id_key" ON "rlc_members"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_member_roles_member_id_role_chapter_id_key" ON "rlc_member_roles"("member_id", "role", "chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_contributions_civicrm_contribution_id_key" ON "rlc_contributions"("civicrm_contribution_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_events_slug_key" ON "rlc_events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_posts_slug_key" ON "rlc_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_civicrm_migration_log_entity_type_civicrm_id_key" ON "rlc_civicrm_migration_log"("entity_type", "civicrm_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_surveys_slug_key" ON "rlc_surveys"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_legislators_legiscan_people_id_key" ON "rlc_legislators"("legiscan_people_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_scorecard_sessions_slug_key" ON "rlc_scorecard_sessions"("slug");

-- CreateIndex
CREATE INDEX "rlc_scorecard_votes_bill_id_idx" ON "rlc_scorecard_votes"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_scorecard_votes_bill_id_legislator_id_key" ON "rlc_scorecard_votes"("bill_id", "legislator_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_action_campaigns_slug_key" ON "rlc_action_campaigns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_campaign_participations_campaign_id_member_id_action_le_key" ON "rlc_campaign_participations"("campaign_id", "member_id", "action", "legislator_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_chapter_stripe_accounts_chapter_id_key" ON "rlc_chapter_stripe_accounts"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_chapter_stripe_accounts_stripe_account_id_key" ON "rlc_chapter_stripe_accounts"("stripe_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_chapter_split_configs_chapter_id_key" ON "rlc_chapter_split_configs"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_chapter_split_rules_config_id_recipient_chapter_id_key" ON "rlc_chapter_split_rules"("config_id", "recipient_chapter_id");

-- CreateIndex
CREATE INDEX "rlc_split_ledger_entries_recipient_chapter_id_status_create_idx" ON "rlc_split_ledger_entries"("recipient_chapter_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_split_ledger_entries_contribution_id_recipient_chapter__key" ON "rlc_split_ledger_entries"("contribution_id", "recipient_chapter_id");

-- AddForeignKey
ALTER TABLE "rlc_chapters" ADD CONSTRAINT "rlc_chapters_parent_chapter_id_fkey" FOREIGN KEY ("parent_chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_members" ADD CONSTRAINT "rlc_members_primary_chapter_id_fkey" FOREIGN KEY ("primary_chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_members" ADD CONSTRAINT "rlc_members_primary_member_id_fkey" FOREIGN KEY ("primary_member_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_member_roles" ADD CONSTRAINT "rlc_member_roles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "rlc_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_member_roles" ADD CONSTRAINT "rlc_member_roles_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_member_roles" ADD CONSTRAINT "rlc_member_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_contributions" ADD CONSTRAINT "rlc_contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_contributions" ADD CONSTRAINT "rlc_contributions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_events" ADD CONSTRAINT "rlc_events_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_events" ADD CONSTRAINT "rlc_events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_event_registrations" ADD CONSTRAINT "rlc_event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "rlc_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_event_registrations" ADD CONSTRAINT "rlc_event_registrations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_event_registrations" ADD CONSTRAINT "rlc_event_registrations_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "rlc_contributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_posts" ADD CONSTRAINT "rlc_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_posts" ADD CONSTRAINT "rlc_posts_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_surveys" ADD CONSTRAINT "rlc_surveys_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_surveys" ADD CONSTRAINT "rlc_surveys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_survey_questions" ADD CONSTRAINT "rlc_survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "rlc_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_responses" ADD CONSTRAINT "rlc_candidate_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "rlc_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_survey_answers" ADD CONSTRAINT "rlc_survey_answers_candidate_response_id_fkey" FOREIGN KEY ("candidate_response_id") REFERENCES "rlc_candidate_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_survey_answers" ADD CONSTRAINT "rlc_survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "rlc_survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_scorecard_sessions" ADD CONSTRAINT "rlc_scorecard_sessions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_scorecard_sessions" ADD CONSTRAINT "rlc_scorecard_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_scorecard_bills" ADD CONSTRAINT "rlc_scorecard_bills_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "rlc_scorecard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_scorecard_votes" ADD CONSTRAINT "rlc_scorecard_votes_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "rlc_scorecard_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_scorecard_votes" ADD CONSTRAINT "rlc_scorecard_votes_legislator_id_fkey" FOREIGN KEY ("legislator_id") REFERENCES "rlc_legislators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_action_campaigns" ADD CONSTRAINT "rlc_action_campaigns_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "rlc_scorecard_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_action_campaigns" ADD CONSTRAINT "rlc_action_campaigns_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_action_campaigns" ADD CONSTRAINT "rlc_action_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_campaign_participations" ADD CONSTRAINT "rlc_campaign_participations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "rlc_action_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_campaign_participations" ADD CONSTRAINT "rlc_campaign_participations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "rlc_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_campaign_participations" ADD CONSTRAINT "rlc_campaign_participations_legislator_id_fkey" FOREIGN KEY ("legislator_id") REFERENCES "rlc_legislators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_chapter_stripe_accounts" ADD CONSTRAINT "rlc_chapter_stripe_accounts_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_chapter_split_configs" ADD CONSTRAINT "rlc_chapter_split_configs_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_chapter_split_configs" ADD CONSTRAINT "rlc_chapter_split_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_chapter_split_rules" ADD CONSTRAINT "rlc_chapter_split_rules_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "rlc_chapter_split_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_chapter_split_rules" ADD CONSTRAINT "rlc_chapter_split_rules_recipient_chapter_id_fkey" FOREIGN KEY ("recipient_chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_split_ledger_entries" ADD CONSTRAINT "rlc_split_ledger_entries_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "rlc_contributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_split_ledger_entries" ADD CONSTRAINT "rlc_split_ledger_entries_recipient_chapter_id_fkey" FOREIGN KEY ("recipient_chapter_id") REFERENCES "rlc_chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_split_ledger_entries" ADD CONSTRAINT "rlc_split_ledger_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "rlc_split_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

