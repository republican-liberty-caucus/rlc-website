-- CreateEnum
CREATE TYPE "SponsorshipRole" AS ENUM ('sponsor', 'cosponsor');

-- AlterEnum
ALTER TYPE "VoteChoice" ADD VALUE 'present';
ALTER TYPE "VoteChoice" ADD VALUE 'not_applicable';

-- AlterTable: ScorecardBill
ALTER TABLE "rlc_scorecard_bills"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "is_bonus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bonus_point_value" DECIMAL(3,1) NOT NULL DEFAULT 0,
ADD COLUMN "vote_result_summary" TEXT;

-- AlterTable: ScorecardVote
ALTER TABLE "rlc_scorecard_votes"
ADD COLUMN "sponsorship_role" "SponsorshipRole";

-- AlterTable: ScorecardSession
ALTER TABLE "rlc_scorecard_sessions"
ADD COLUMN "chamber" "LegislativeChamber",
ADD COLUMN "party_filter" TEXT,
ADD COLUMN "absence_penalty_threshold" INTEGER NOT NULL DEFAULT 3;

-- CreateTable: ScorecardLegislatorScore
CREATE TABLE "rlc_scorecard_legislator_scores" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "legislator_id" TEXT NOT NULL,
    "votes_aligned" INTEGER NOT NULL DEFAULT 0,
    "total_bills" INTEGER NOT NULL DEFAULT 0,
    "absences" INTEGER NOT NULL DEFAULT 0,
    "bonus_points" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "liberty_score" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_scorecard_legislator_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rlc_scorecard_legislator_scores_session_id_idx" ON "rlc_scorecard_legislator_scores"("session_id");

-- CreateIndex
CREATE INDEX "rlc_scorecard_legislator_scores_legislator_id_idx" ON "rlc_scorecard_legislator_scores"("legislator_id");

-- CreateIndex
CREATE UNIQUE INDEX "rlc_scorecard_legislator_scores_session_id_legislator_id_key" ON "rlc_scorecard_legislator_scores"("session_id", "legislator_id");

-- AddForeignKey
ALTER TABLE "rlc_scorecard_legislator_scores" ADD CONSTRAINT "rlc_scorecard_legislator_scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "rlc_scorecard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rlc_scorecard_legislator_scores" ADD CONSTRAINT "rlc_scorecard_legislator_scores_legislator_id_fkey" FOREIGN KEY ("legislator_id") REFERENCES "rlc_legislators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
