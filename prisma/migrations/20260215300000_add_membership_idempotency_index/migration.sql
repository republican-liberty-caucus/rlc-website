-- CreateIndex (idempotency: prevents duplicate membership rows for the same subscription period)
-- PostgreSQL NULL semantics: rows with NULL stripe_subscription_id are never considered duplicates,
-- so one-time payment memberships are unaffected.
CREATE UNIQUE INDEX "rlc_memberships_contact_id_start_date_stripe_subscription_id_key"
  ON "rlc_memberships"("contact_id", "start_date", "stripe_subscription_id");
