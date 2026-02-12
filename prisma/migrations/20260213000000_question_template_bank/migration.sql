-- 1. Create new enums
CREATE TYPE "ElectionType" AS ENUM ('primary', 'general', 'special', 'runoff', 'primary_runoff');
CREATE TYPE "QuestionCategory" AS ENUM (
  'fiscal_policy', 'constitutional_rights', 'second_amendment',
  'judicial_philosophy', 'immigration', 'healthcare', 'education',
  'foreign_policy', 'criminal_justice', 'regulatory_reform',
  'property_rights', 'other'
);

-- 2. Add office_type_id FK to surveys
ALTER TABLE "rlc_surveys" ADD COLUMN "office_type_id" UUID
  REFERENCES "rlc_office_types"("id") ON DELETE SET NULL;
CREATE INDEX "idx_surveys_office_type" ON "rlc_surveys" ("office_type_id");

-- 3. Convert election_type from text to enum
ALTER TABLE "rlc_surveys" ADD COLUMN "election_type_new" "ElectionType";
UPDATE "rlc_surveys" SET "election_type_new" = CASE
  WHEN "election_type" = 'primary' THEN 'primary'::"ElectionType"
  WHEN "election_type" = 'general' THEN 'general'::"ElectionType"
  WHEN "election_type" = 'special' THEN 'special'::"ElectionType"
  WHEN "election_type" IS NULL THEN NULL
  ELSE 'general'::"ElectionType"
END;
ALTER TABLE "rlc_surveys" DROP COLUMN "election_type";
ALTER TABLE "rlc_surveys" RENAME COLUMN "election_type_new" TO "election_type";

-- 4. Replace freeform election_date with structured date columns + deadline FK
ALTER TABLE "rlc_surveys" ADD COLUMN "primary_date" DATE;
ALTER TABLE "rlc_surveys" ADD COLUMN "general_date" DATE;
ALTER TABLE "rlc_surveys" ADD COLUMN "election_deadline_id" UUID
  REFERENCES "rlc_candidate_election_deadlines"("id") ON DELETE SET NULL;
CREATE INDEX "idx_surveys_election_deadline" ON "rlc_surveys" ("election_deadline_id");

-- Migrate existing election_date values to general_date (single date was typically general)
-- Only convert values that strictly match YYYY-MM-DD format (anchored regex)
UPDATE "rlc_surveys" SET "general_date" = "election_date"::DATE
  WHERE "election_date" IS NOT NULL AND "election_date" ~ '^\d{4}-\d{2}-\d{2}$';

ALTER TABLE "rlc_surveys" DROP COLUMN "election_date";

-- 5. Create question templates table
CREATE TABLE "rlc_question_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_text" TEXT NOT NULL,
  "question_type" "QuestionType" NOT NULL,
  "options" TEXT[] NOT NULL DEFAULT '{}',
  "weight" DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  "ideal_answer" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "office_levels" "OfficeLevel"[] NOT NULL,
  "category" "QuestionCategory" NOT NULL DEFAULT 'other',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_question_templates_office_levels" ON "rlc_question_templates" USING GIN ("office_levels");
CREATE INDEX "idx_question_templates_category" ON "rlc_question_templates" ("category");
CREATE INDEX "idx_question_templates_active" ON "rlc_question_templates" ("is_active");
