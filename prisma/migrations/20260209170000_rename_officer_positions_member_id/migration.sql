-- Rename member_id to contact_id in rlc_officer_positions (table may not exist in all environments)
DO $$ BEGIN
  ALTER TABLE "rlc_officer_positions" RENAME COLUMN "member_id" TO "contact_id";
EXCEPTION WHEN undefined_table THEN NULL;
          WHEN undefined_column THEN NULL;
END $$;

-- Rename the foreign key constraint to match the new column name
DO $$ BEGIN
  ALTER TABLE "rlc_officer_positions"
    RENAME CONSTRAINT "rlc_officer_positions_member_id_fkey" TO "rlc_officer_positions_contact_id_fkey";
EXCEPTION WHEN undefined_table THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

-- Rename the unique constraint if it exists (used for upsert conflict target)
DO $$ BEGIN
  ALTER INDEX "rlc_officer_positions_member_id_charter_id_title_committee_name"
    RENAME TO "rlc_officer_positions_contact_id_charter_id_title_committee_nam";
EXCEPTION WHEN undefined_table THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;
