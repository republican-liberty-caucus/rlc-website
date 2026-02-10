-- Fix: Prisma generates UUIDs client-side, but Supabase REST API inserts need
-- database-level defaults. Add DEFAULT gen_random_uuid() to all TEXT id columns.
-- This prevents NOT NULL violations when inserting via Supabase client.

-- ===========================================
-- Step 1: Enable pgcrypto if not already enabled (for gen_random_uuid)
-- ===========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- Step 2: Add UUID defaults to all tables with TEXT id columns
-- ===========================================
ALTER TABLE "rlc_charters" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_member_roles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_contributions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_event_registrations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_posts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_highlevel_sync_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_civicrm_migration_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_surveys" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_survey_questions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_candidate_responses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_survey_answers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_legislators" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_scorecard_sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_scorecard_bills" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_scorecard_votes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_action_campaigns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_campaign_participations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_charter_stripe_accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_charter_split_configs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_charter_split_rules" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "rlc_split_ledger_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- ===========================================
-- Step 3: Create webhook events table for idempotency
-- ===========================================
CREATE TABLE IF NOT EXISTS "rlc_webhook_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "stripe_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rlc_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rlc_webhook_events_stripe_event_id_key"
    ON "rlc_webhook_events"("stripe_event_id");
