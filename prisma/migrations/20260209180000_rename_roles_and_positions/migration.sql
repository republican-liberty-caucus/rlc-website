-- Rename officer positions table (may not exist in all environments)
DO $$ BEGIN
  ALTER TABLE "rlc_officer_positions" RENAME TO "rlc_organizational_positions";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Rename foreign key constraints to match new table name
DO $$ BEGIN
  ALTER TABLE "rlc_organizational_positions"
    RENAME CONSTRAINT "rlc_officer_positions_contact_id_fkey"
    TO "rlc_organizational_positions_contact_id_fkey";
EXCEPTION WHEN undefined_table THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rlc_organizational_positions"
    RENAME CONSTRAINT "rlc_officer_positions_charter_id_fkey"
    TO "rlc_organizational_positions_charter_id_fkey";
EXCEPTION WHEN undefined_table THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rlc_organizational_positions"
    RENAME CONSTRAINT "rlc_officer_positions_appointed_by_id_fkey"
    TO "rlc_organizational_positions_appointed_by_id_fkey";
EXCEPTION WHEN undefined_table THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

-- Rename unique index (indexes are "relations" in PG, so undefined_table not undefined_object)
DO $$ BEGIN
  ALTER INDEX "rlc_officer_positions_contact_id_charter_id_title_committee_nam"
    RENAME TO "rlc_org_positions_contact_charter_title_committee";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Rename UserRole enum values (idempotent — safe to re-run)
DO $$ BEGIN
  ALTER TYPE "UserRole" RENAME VALUE 'chapter_officer' TO 'charter_officer';
EXCEPTION WHEN invalid_parameter_value THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" RENAME VALUE 'chapter_admin' TO 'charter_admin';
EXCEPTION WHEN invalid_parameter_value THEN NULL;
END $$;
