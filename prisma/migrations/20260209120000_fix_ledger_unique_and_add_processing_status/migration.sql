-- AlterEnum: Add 'processing' to SplitLedgerStatus
ALTER TYPE "SplitLedgerStatus" ADD VALUE 'processing';

-- DropIndex: Remove unique constraint that blocks reversal entries
DROP INDEX IF EXISTS "rlc_split_ledger_entries_contribution_id_recipient_charter_id_key";

-- CreateIndex: Add non-unique index for query performance
CREATE INDEX IF NOT EXISTS "rlc_split_ledger_entries_contribution_id_recipient_charter_id_idx"
  ON "rlc_split_ledger_entries"("contribution_id", "recipient_charter_id");
