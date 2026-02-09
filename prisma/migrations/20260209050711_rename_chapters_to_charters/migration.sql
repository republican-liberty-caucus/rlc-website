-- Rename "chapters" → "charters" across all tables and columns
-- These are metadata-only ALTER operations — zero data loss risk.

-- ===========================================
-- Step 1: Rename enum types
-- ===========================================
ALTER TYPE "ChapterLevel" RENAME TO "CharterLevel";
ALTER TYPE "ChapterStatus" RENAME TO "CharterStatus";

-- ===========================================
-- Step 2: Rename tables
-- ===========================================
ALTER TABLE "rlc_chapters" RENAME TO "rlc_charters";
ALTER TABLE "rlc_chapter_stripe_accounts" RENAME TO "rlc_charter_stripe_accounts";
ALTER TABLE "rlc_chapter_split_configs" RENAME TO "rlc_charter_split_configs";
ALTER TABLE "rlc_chapter_split_rules" RENAME TO "rlc_charter_split_rules";

-- Onboarding tables (may not exist in all environments)
DO $$ BEGIN
  ALTER TABLE "rlc_chapter_onboarding" RENAME TO "rlc_charter_onboarding";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rlc_chapter_onboarding_steps" RENAME TO "rlc_charter_onboarding_steps";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ===========================================
-- Step 3: Rename columns on rlc_charters (formerly rlc_chapters)
-- ===========================================
ALTER TABLE "rlc_charters" RENAME COLUMN "chapter_level" TO "charter_level";
ALTER TABLE "rlc_charters" RENAME COLUMN "parent_chapter_id" TO "parent_charter_id";

-- ===========================================
-- Step 4: Rename chapter_id columns across all referencing tables
-- ===========================================
ALTER TABLE "rlc_members" RENAME COLUMN "primary_chapter_id" TO "primary_charter_id";
ALTER TABLE "rlc_member_roles" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_contributions" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_events" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_posts" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_surveys" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_scorecard_sessions" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_action_campaigns" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_charter_stripe_accounts" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_charter_split_configs" RENAME COLUMN "chapter_id" TO "charter_id";
ALTER TABLE "rlc_charter_split_rules" RENAME COLUMN "recipient_chapter_id" TO "recipient_charter_id";
ALTER TABLE "rlc_split_ledger_entries" RENAME COLUMN "recipient_chapter_id" TO "recipient_charter_id";

-- Officer positions table (may not exist in all environments)
DO $$ BEGIN
  ALTER TABLE "rlc_officer_positions" RENAME COLUMN "chapter_id" TO "charter_id";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Onboarding table column rename
DO $$ BEGIN
  ALTER TABLE "rlc_charter_onboarding" RENAME COLUMN "chapter_id" TO "charter_id";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
