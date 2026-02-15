-- Split candidate_name into candidate_first_name + candidate_last_name
-- Both tables: rlc_candidate_responses and rlc_candidate_vettings

-- === rlc_candidate_responses ===

-- 1. Add new columns
ALTER TABLE "rlc_candidate_responses"
  ADD COLUMN "candidate_first_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "candidate_last_name" TEXT NOT NULL DEFAULT '';

-- 2. Backfill: split at first space. Single-word → first only, last = ''
UPDATE "rlc_candidate_responses" SET
  "candidate_first_name" = CASE
    WHEN POSITION(' ' IN TRIM("candidate_name")) > 0
      THEN LEFT(TRIM("candidate_name"), POSITION(' ' IN TRIM("candidate_name")) - 1)
    ELSE TRIM("candidate_name")
  END,
  "candidate_last_name" = CASE
    WHEN POSITION(' ' IN TRIM("candidate_name")) > 0
      THEN TRIM(SUBSTRING(TRIM("candidate_name") FROM POSITION(' ' IN TRIM("candidate_name")) + 1))
    ELSE ''
  END;

-- 3. Drop default on first_name (last_name keeps DEFAULT '' to match Prisma @default(""))
ALTER TABLE "rlc_candidate_responses"
  ALTER COLUMN "candidate_first_name" DROP DEFAULT;

-- 4. Drop old column
ALTER TABLE "rlc_candidate_responses" DROP COLUMN "candidate_name";


-- === rlc_candidate_vettings ===

-- 1. Add new columns
ALTER TABLE "rlc_candidate_vettings"
  ADD COLUMN "candidate_first_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "candidate_last_name" TEXT NOT NULL DEFAULT '';

-- 2. Backfill
UPDATE "rlc_candidate_vettings" SET
  "candidate_first_name" = CASE
    WHEN POSITION(' ' IN TRIM("candidate_name")) > 0
      THEN LEFT(TRIM("candidate_name"), POSITION(' ' IN TRIM("candidate_name")) - 1)
    ELSE TRIM("candidate_name")
  END,
  "candidate_last_name" = CASE
    WHEN POSITION(' ' IN TRIM("candidate_name")) > 0
      THEN TRIM(SUBSTRING(TRIM("candidate_name") FROM POSITION(' ' IN TRIM("candidate_name")) + 1))
    ELSE ''
  END;

-- 3. Drop default on first_name (last_name keeps DEFAULT '' to match Prisma @default(""))
ALTER TABLE "rlc_candidate_vettings"
  ALTER COLUMN "candidate_first_name" DROP DEFAULT;

-- 4. Drop old column
ALTER TABLE "rlc_candidate_vettings" DROP COLUMN "candidate_name";
