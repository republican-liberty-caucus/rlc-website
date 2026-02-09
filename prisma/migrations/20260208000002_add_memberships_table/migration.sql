-- CreateTable
CREATE TABLE "rlc_memberships" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "membership_tier" "MembershipTier" NOT NULL,
    "membership_status" "MembershipStatus" NOT NULL,
    "start_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "join_date" TIMESTAMP(3),
    "amount" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'USD',
    "civicrm_membership_id" INTEGER,
    "is_auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "stripe_subscription_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rlc_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rlc_memberships_civicrm_membership_id_key" ON "rlc_memberships"("civicrm_membership_id");

-- CreateIndex
CREATE INDEX "rlc_memberships_contact_id_idx" ON "rlc_memberships"("contact_id");

-- CreateIndex
CREATE INDEX "rlc_memberships_membership_status_idx" ON "rlc_memberships"("membership_status");

-- CreateIndex
CREATE INDEX "rlc_memberships_expiry_date_idx" ON "rlc_memberships"("expiry_date");

-- AddForeignKey
ALTER TABLE "rlc_memberships" ADD CONSTRAINT "rlc_memberships_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "rlc_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
