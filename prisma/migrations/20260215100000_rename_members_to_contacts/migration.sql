-- Rename tables: rlc_members → rlc_contacts, rlc_member_roles → rlc_contact_roles
-- This completes Phase 4 of the schema restructure (Feb 8, 2026)

-- Step 1: Rename tables
ALTER TABLE "rlc_members" RENAME TO "rlc_contacts";
ALTER TABLE "rlc_member_roles" RENAME TO "rlc_contact_roles";

-- Step 2: Rename primary key constraints
ALTER TABLE "rlc_contacts" RENAME CONSTRAINT "rlc_members_pkey" TO "rlc_contacts_pkey";
ALTER TABLE "rlc_contact_roles" RENAME CONSTRAINT "rlc_member_roles_pkey" TO "rlc_contact_roles_pkey";

-- Step 3: Rename FK constraints on rlc_contacts (self-referential and charter)
ALTER TABLE "rlc_contacts" RENAME CONSTRAINT "rlc_members_primary_member_id_fkey" TO "rlc_contacts_primary_contact_id_fkey";
ALTER TABLE "rlc_contacts" RENAME CONSTRAINT "rlc_members_primary_chapter_id_fkey" TO "rlc_contacts_primary_charter_id_fkey";

-- Step 4: Rename FK constraints on rlc_contact_roles
ALTER TABLE "rlc_contact_roles" RENAME CONSTRAINT "rlc_member_roles_member_id_fkey" TO "rlc_contact_roles_contact_id_fkey";
ALTER TABLE "rlc_contact_roles" RENAME CONSTRAINT "rlc_member_roles_chapter_id_fkey" TO "rlc_contact_roles_charter_id_fkey";
ALTER TABLE "rlc_contact_roles" RENAME CONSTRAINT "rlc_member_roles_granted_by_fkey" TO "rlc_contact_roles_granted_by_fkey";

-- Step 5: Rename unique indexes on rlc_contacts
ALTER INDEX "rlc_members_clerk_user_id_key" RENAME TO "rlc_contacts_clerk_user_id_key";
ALTER INDEX "rlc_members_email_key" RENAME TO "rlc_contacts_email_key";
ALTER INDEX "rlc_members_civicrm_contact_id_key" RENAME TO "rlc_contacts_civicrm_contact_id_key";
ALTER INDEX "rlc_members_highlevel_contact_id_key" RENAME TO "rlc_contacts_highlevel_contact_id_key";
ALTER INDEX "rlc_members_stripe_customer_id_key" RENAME TO "rlc_contacts_stripe_customer_id_key";

-- Step 6: Rename custom indexes on rlc_contacts
ALTER INDEX "idx_rlc_members_household_id" RENAME TO "idx_rlc_contacts_household_id";
ALTER INDEX "idx_rlc_members_membership_join_date" RENAME TO "idx_rlc_contacts_membership_join_date";
ALTER INDEX "idx_rlc_members_membership_status" RENAME TO "idx_rlc_contacts_membership_status";
ALTER INDEX "idx_rlc_members_membership_tier" RENAME TO "idx_rlc_contacts_membership_tier";
ALTER INDEX "idx_rlc_members_primary_charter_id" RENAME TO "idx_rlc_contacts_primary_charter_id";

-- Step 7: Rename unique compound index on rlc_contact_roles
ALTER INDEX "rlc_member_roles_member_id_role_chapter_id_key" RENAME TO "rlc_contact_roles_contact_id_role_charter_id_key";
