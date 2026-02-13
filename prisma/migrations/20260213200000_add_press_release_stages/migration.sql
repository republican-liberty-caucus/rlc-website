-- Add press release stages to VettingStage enum
ALTER TYPE "VettingStage" ADD VALUE 'press_release_created';
ALTER TYPE "VettingStage" ADD VALUE 'press_release_published';

-- Add press release columns to candidate vettings
ALTER TABLE "rlc_candidate_vettings" ADD COLUMN "press_release_url" TEXT;
ALTER TABLE "rlc_candidate_vettings" ADD COLUMN "press_release_notes" TEXT;
