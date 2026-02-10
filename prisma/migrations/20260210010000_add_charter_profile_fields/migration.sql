-- Add charter profile fields for public display
ALTER TABLE "rlc_charters" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "rlc_charters" ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(20);
ALTER TABLE "rlc_charters" ADD COLUMN IF NOT EXISTS "facebook_url" TEXT;
ALTER TABLE "rlc_charters" ADD COLUMN IF NOT EXISTS "twitter_url" TEXT;
ALTER TABLE "rlc_charters" ADD COLUMN IF NOT EXISTS "bylaws_url" TEXT;
