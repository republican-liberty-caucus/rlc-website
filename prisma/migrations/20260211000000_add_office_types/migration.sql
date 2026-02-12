-- CreateEnum
CREATE TYPE "OfficeLevel" AS ENUM ('federal', 'state', 'county', 'municipal', 'judicial', 'special_district');

-- CreateTable
CREATE TABLE "rlc_office_types" (
    "id" TEXT NOT NULL,
    "level" "OfficeLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "endorsing_charter_level" "CharterLevel" NOT NULL,
    "requires_state" BOOLEAN NOT NULL DEFAULT true,
    "requires_district" BOOLEAN NOT NULL DEFAULT false,
    "requires_county" BOOLEAN NOT NULL DEFAULT false,
    "district_label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_office_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rlc_office_types_slug_key" ON "rlc_office_types"("slug");

-- AlterTable: Add structured office fields to candidate responses
ALTER TABLE "rlc_candidate_responses"
ADD COLUMN "office_type_id" TEXT,
ADD COLUMN "candidate_state" CHAR(2),
ADD COLUMN "candidate_county" TEXT;

-- AlterTable: Add structured office fields and charter scoping to candidate vettings
ALTER TABLE "rlc_candidate_vettings"
ADD COLUMN "office_type_id" TEXT,
ADD COLUMN "charter_id" TEXT;

-- AddForeignKey
ALTER TABLE "rlc_candidate_responses" ADD CONSTRAINT "rlc_candidate_responses_office_type_id_fkey" FOREIGN KEY ("office_type_id") REFERENCES "rlc_office_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_candidate_vettings" ADD CONSTRAINT "rlc_candidate_vettings_office_type_id_fkey" FOREIGN KEY ("office_type_id") REFERENCES "rlc_office_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex for pipeline scoping
CREATE INDEX "rlc_candidate_vettings_charter_id_idx" ON "rlc_candidate_vettings"("charter_id");
CREATE INDEX "rlc_candidate_vettings_office_type_id_idx" ON "rlc_candidate_vettings"("office_type_id");
CREATE INDEX "rlc_office_types_endorsing_charter_level_idx" ON "rlc_office_types"("endorsing_charter_level");
