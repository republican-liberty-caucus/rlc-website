-- CreateIndex (idempotency: prevents duplicate membership rows for the same subscription period)
-- PostgreSQL NULL semantics: NULL != NULL, so this index only deduplicates rows where ALL three
-- columns are non-null. One-time payments (NULL stripe_subscription_id) and rows with NULL
-- start_date are NOT protected — idempotency for those relies on upstream webhook event dedup.
CREATE UNIQUE INDEX "rlc_memberships_contact_id_start_date_stripe_subscription_id_key"
  ON "rlc_memberships"("contact_id", "start_date", "stripe_subscription_id");
