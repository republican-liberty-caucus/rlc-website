-- AlterTable: Add press_release_post_id FK to candidate vettings
ALTER TABLE "rlc_candidate_vettings" ADD COLUMN "press_release_post_id" TEXT;

-- CreateIndex: Unique constraint on press_release_post_id
CREATE UNIQUE INDEX "rlc_candidate_vettings_press_release_post_id_key" ON "rlc_candidate_vettings"("press_release_post_id");

-- AddForeignKey
ALTER TABLE "rlc_candidate_vettings"
  ADD CONSTRAINT "rlc_candidate_vettings_press_release_post_id_fkey"
  FOREIGN KEY ("press_release_post_id") REFERENCES "rlc_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
