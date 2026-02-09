-- AlterTable
ALTER TABLE "rlc_members" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "rlc_members" ADD COLUMN     "email_validated_at" TIMESTAMP(3),
ADD COLUMN     "email_status" TEXT,
ADD COLUMN     "email_overall_score" INTEGER,
ADD COLUMN     "email_is_safe_to_send" BOOLEAN,
ADD COLUMN     "email_is_valid_syntax" BOOLEAN,
ADD COLUMN     "email_is_disposable" BOOLEAN,
ADD COLUMN     "email_is_role_account" BOOLEAN,
ADD COLUMN     "email_is_spamtrap" BOOLEAN,
ADD COLUMN     "email_is_free_email" BOOLEAN,
ADD COLUMN     "email_is_deliverable" BOOLEAN,
ADD COLUMN     "email_is_catch_all" BOOLEAN,
ADD COLUMN     "email_mx_accepts_mail" BOOLEAN;
