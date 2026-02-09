-- CreateEnum
CREATE TYPE "VettingStage" AS ENUM ('survey_submitted', 'auto_audit', 'assigned', 'research', 'interview', 'committee_review', 'board_vote');

-- CreateEnum
CREATE TYPE "VettingReportSectionType" AS ENUM ('digital_presence_audit', 'executive_summary', 'election_schedule', 'voting_rules', 'candidate_background', 'incumbent_record', 'opponent_research', 'electoral_results', 'district_data');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('audit_pending', 'running', 'audit_completed', 'audit_failed');

-- CreateEnum
CREATE TYPE "VettingRecommendation" AS ENUM ('endorse', 'do_not_endorse', 'no_position');

-- CreateEnum
CREATE TYPE "VettingSectionStatus" AS ENUM ('section_not_started', 'section_assigned', 'section_in_progress', 'section_completed', 'needs_revision');

-- CreateEnum
CREATE TYPE "BoardVoteChoice" AS ENUM ('vote_endorse', 'vote_do_not_endorse', 'vote_no_position', 'vote_abstain');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('chair', 'committee_member');

-- CreateTable
CREATE TABLE "rlc_candidate_vetting_committees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_vetting_committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_vetting_committee_members" (
    "id" TEXT NOT NULL,
    "committee_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "role" "CommitteeRole" NOT NULL DEFAULT 'committee_member',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_vetting_committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_vettings" (
    "id" TEXT NOT NULL,
    "candidate_response_id" TEXT NOT NULL,
    "committee_id" TEXT,
    "stage" "VettingStage" NOT NULL DEFAULT 'survey_submitted',
    "candidate_name" TEXT NOT NULL,
    "candidate_office" TEXT,
    "candidate_district" TEXT,
    "candidate_state" TEXT,
    "candidate_party" TEXT,
    "election_deadline_id" TEXT,
    "district_data_id" TEXT,
    "interview_date" TIMESTAMP(3),
    "interview_notes" TEXT,
    "interviewers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendation" "VettingRecommendation",
    "recommendation_notes" TEXT,
    "recommended_at" TIMESTAMP(3),
    "endorsement_result" "VettingRecommendation",
    "endorsed_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_vettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_vetting_report_sections" (
    "id" TEXT NOT NULL,
    "vetting_id" TEXT NOT NULL,
    "section" "VettingReportSectionType" NOT NULL,
    "status" "VettingSectionStatus" NOT NULL DEFAULT 'section_not_started',
    "data" JSONB NOT NULL DEFAULT '{}',
    "ai_draft_data" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_vetting_report_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_vetting_section_assignments" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "committee_member_id" TEXT NOT NULL,
    "assigned_by_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_candidate_vetting_section_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_vetting_opponents" (
    "id" TEXT NOT NULL,
    "vetting_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT,
    "is_incumbent" BOOLEAN NOT NULL DEFAULT false,
    "background" TEXT,
    "credibility" TEXT,
    "fundraising" JSONB,
    "endorsements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "social_links" JSONB,
    "photo_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_vetting_opponents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_vetting_board_votes" (
    "id" TEXT NOT NULL,
    "vetting_id" TEXT NOT NULL,
    "voter_id" TEXT NOT NULL,
    "vote" "BoardVoteChoice" NOT NULL,
    "notes" TEXT,
    "voted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_candidate_vetting_board_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_election_deadlines" (
    "id" TEXT NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "cycle_year" INTEGER NOT NULL,
    "office_type" TEXT NOT NULL,
    "primary_date" DATE,
    "primary_runoff_date" DATE,
    "general_date" DATE,
    "general_runoff_date" DATE,
    "filing_deadline" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_election_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_district_data" (
    "id" TEXT NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "district_id" TEXT NOT NULL,
    "office_type" TEXT NOT NULL,
    "cook_pvi" TEXT,
    "population" INTEGER,
    "party_registration" JSONB,
    "municipalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "counties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overlapping_districts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "electoral_history" JSONB,
    "map_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_district_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_digital_audits" (
    "id" TEXT NOT NULL,
    "vetting_id" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'audit_pending',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "triggered_by_id" TEXT,
    "candidate_overall_score" INTEGER,
    "candidate_grade" TEXT,
    "candidate_score_breakdown" JSONB,
    "candidate_risks" JSONB,
    "opponent_audits" JSONB,
    "discovery_log" JSONB,
    "screenshots_manifest" JSONB,
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_digital_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rlc_candidate_audit_platforms" (
    "id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "platform_name" TEXT NOT NULL,
    "platform_url" TEXT,
    "confidence_score" DECIMAL(3,2),
    "discovery_method" TEXT,
    "activity_status" TEXT,
    "last_activity_date" TIMESTAMP(3),
    "followers" INTEGER,
    "engagement_rate" DECIMAL(5,2),
    "screenshot_desktop_url" TEXT,
    "screenshot_mobile_url" TEXT,
    "score_presence" INTEGER,
    "score_consistency" INTEGER,
    "score_quality" INTEGER,
    "score_accessibility" INTEGER,
    "total_score" INTEGER,
    "grade" TEXT,
    "contact_methods" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_candidate_audit_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rlc_candidate_vetting_committee_members_committee_id_contac_key" ON "rlc_candidate_vetting_committee_members"("committee_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_candidate_vettings_candidate_response_id_key" ON "rlc_candidate_vettings"("candidate_response_id");

-- CreateIndex
CREATE INDEX "rlc_candidate_vettings_stage_idx" ON "rlc_candidate_vettings"("stage");

-- CreateIndex
CREATE INDEX "rlc_candidate_vettings_candidate_state_idx" ON "rlc_candidate_vettings"("candidate_state");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_candidate_vetting_report_sections_vetting_id_section_key" ON "rlc_candidate_vetting_report_sections"("vetting_id", "section");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_candidate_vetting_section_assignments_section_id_commit_key" ON "rlc_candidate_vetting_section_assignments"("section_id", "committee_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_candidate_vetting_board_votes_vetting_id_voter_id_key" ON "rlc_candidate_vetting_board_votes"("vetting_id", "voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_candidate_election_deadlines_state_code_cycle_year_offi_key" ON "rlc_candidate_election_deadlines"("state_code", "cycle_year", "office_type");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_candidate_district_data_state_code_district_id_office_t_key" ON "rlc_candidate_district_data"("state_code", "district_id", "office_type");

-- CreateIndex
CREATE INDEX "rlc_candidate_digital_audits_vetting_id_idx" ON "rlc_candidate_digital_audits"("vetting_id");

-- CreateIndex
CREATE INDEX "rlc_candidate_audit_platforms_audit_id_entity_type_idx" ON "rlc_candidate_audit_platforms"("audit_id", "entity_type");

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_committee_members" ADD CONSTRAINT "rlc_candidate_vetting_committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "rlc_candidate_vetting_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_committee_members" ADD CONSTRAINT "rlc_candidate_vetting_committee_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "rlc_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vettings" ADD CONSTRAINT "rlc_candidate_vettings_candidate_response_id_fkey" FOREIGN KEY ("candidate_response_id") REFERENCES "rlc_candidate_responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vettings" ADD CONSTRAINT "rlc_candidate_vettings_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "rlc_candidate_vetting_committees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vettings" ADD CONSTRAINT "rlc_candidate_vettings_election_deadline_id_fkey" FOREIGN KEY ("election_deadline_id") REFERENCES "rlc_candidate_election_deadlines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vettings" ADD CONSTRAINT "rlc_candidate_vettings_district_data_id_fkey" FOREIGN KEY ("district_data_id") REFERENCES "rlc_candidate_district_data"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_report_sections" ADD CONSTRAINT "rlc_candidate_vetting_report_sections_vetting_id_fkey" FOREIGN KEY ("vetting_id") REFERENCES "rlc_candidate_vettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_section_assignments" ADD CONSTRAINT "rlc_candidate_vetting_section_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "rlc_candidate_vetting_report_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_section_assignments" ADD CONSTRAINT "rlc_candidate_vetting_section_assignments_committee_member_fkey" FOREIGN KEY ("committee_member_id") REFERENCES "rlc_candidate_vetting_committee_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_section_assignments" ADD CONSTRAINT "rlc_candidate_vetting_section_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_opponents" ADD CONSTRAINT "rlc_candidate_vetting_opponents_vetting_id_fkey" FOREIGN KEY ("vetting_id") REFERENCES "rlc_candidate_vettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_board_votes" ADD CONSTRAINT "rlc_candidate_vetting_board_votes_vetting_id_fkey" FOREIGN KEY ("vetting_id") REFERENCES "rlc_candidate_vettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vetting_board_votes" ADD CONSTRAINT "rlc_candidate_vetting_board_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "rlc_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_digital_audits" ADD CONSTRAINT "rlc_candidate_digital_audits_vetting_id_fkey" FOREIGN KEY ("vetting_id") REFERENCES "rlc_candidate_vettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_digital_audits" ADD CONSTRAINT "rlc_candidate_digital_audits_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_audit_platforms" ADD CONSTRAINT "rlc_candidate_audit_platforms_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "rlc_candidate_digital_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
