-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'candidate';

-- AlterTable
ALTER TABLE "rlc_candidate_responses" ADD COLUMN "contact_id" TEXT;

-- AddForeignKey
ALTER TABLE "rlc_candidate_responses" ADD CONSTRAINT "rlc_candidate_responses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "rlc_candidate_responses_contact_id_idx" ON "rlc_candidate_responses"("contact_id");

-- Backfill: link existing candidates to contacts by email match
UPDATE "rlc_candidate_responses" cr
SET "contact_id" = m."id"
FROM "rlc_members" m
WHERE LOWER(cr."candidate_email") = LOWER(m."email")
  AND cr."contact_id" IS NULL
  AND cr."candidate_email" IS NOT NULL;
