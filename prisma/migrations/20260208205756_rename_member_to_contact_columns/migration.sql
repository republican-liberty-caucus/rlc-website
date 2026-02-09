-- Rename member_id columns to contact_id across all tables
-- This completes Phase 3 of the schema restructure (database column names match code)

-- 1. Rename primary_member_id to primary_contact_id in rlc_members
ALTER TABLE "rlc_members"
  RENAME COLUMN "primary_member_id" TO "primary_contact_id";

-- 2. Rename member_id to contact_id in rlc_member_roles
ALTER TABLE "rlc_member_roles"
  RENAME COLUMN "member_id" TO "contact_id";

-- 3. Rename member_id to contact_id in rlc_contributions
ALTER TABLE "rlc_contributions"
  RENAME COLUMN "member_id" TO "contact_id";

-- 4. Rename member_id to contact_id in rlc_event_registrations
ALTER TABLE "rlc_event_registrations"
  RENAME COLUMN "member_id" TO "contact_id";

-- 5. Rename member_id to contact_id in rlc_campaign_participations
ALTER TABLE "rlc_campaign_participations"
  RENAME COLUMN "member_id" TO "contact_id";
