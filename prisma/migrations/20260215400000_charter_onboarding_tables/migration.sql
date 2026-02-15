-- Create charter onboarding tables for the forming-charter onboarding workflow.
-- All ID/FK columns are TEXT (not UUID) matching existing rlc_contacts and rlc_charters patterns.

-- ============================================================
-- Table: rlc_charter_onboarding (one per forming charter)
-- ============================================================
CREATE TABLE "rlc_charter_onboarding" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "charter_id" TEXT NOT NULL,
  "coordinator_id" TEXT NOT NULL,
  "current_step" TEXT NOT NULL DEFAULT 'coordinator_membership',
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  "approved_at" TIMESTAMPTZ,
  "approved_by_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "rlc_charter_onboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rlc_charter_onboarding_charter_id_fkey"
    FOREIGN KEY ("charter_id") REFERENCES "rlc_charters"("id") ON DELETE CASCADE,
  CONSTRAINT "rlc_charter_onboarding_coordinator_id_fkey"
    FOREIGN KEY ("coordinator_id") REFERENCES "rlc_contacts"("id") ON DELETE RESTRICT,
  CONSTRAINT "rlc_charter_onboarding_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "rlc_contacts"("id") ON DELETE SET NULL
);

-- One onboarding record per charter
CREATE UNIQUE INDEX "rlc_charter_onboarding_charter_id_key"
  ON "rlc_charter_onboarding" ("charter_id");

-- ============================================================
-- Table: rlc_charter_onboarding_steps (per-step progress)
-- ============================================================
CREATE TABLE "rlc_charter_onboarding_steps" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "onboarding_id" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "data" JSONB NOT NULL DEFAULT '{}',
  "completed_at" TIMESTAMPTZ,
  "completed_by_id" TEXT,
  "reviewed_at" TIMESTAMPTZ,
  "reviewed_by_id" TEXT,
  "review_notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "rlc_charter_onboarding_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rlc_charter_onboarding_steps_onboarding_id_fkey"
    FOREIGN KEY ("onboarding_id") REFERENCES "rlc_charter_onboarding"("id") ON DELETE CASCADE,
  CONSTRAINT "rlc_charter_onboarding_steps_completed_by_id_fkey"
    FOREIGN KEY ("completed_by_id") REFERENCES "rlc_contacts"("id") ON DELETE SET NULL,
  CONSTRAINT "rlc_charter_onboarding_steps_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "rlc_contacts"("id") ON DELETE SET NULL
);

-- One row per step per onboarding
CREATE UNIQUE INDEX "rlc_charter_onboarding_steps_onboarding_step_key"
  ON "rlc_charter_onboarding_steps" ("onboarding_id", "step");

-- Index for lookups by onboarding
CREATE INDEX "rlc_charter_onboarding_steps_onboarding_id_idx"
  ON "rlc_charter_onboarding_steps" ("onboarding_id");

-- ============================================================
-- RLS: permissive (API uses service role key)
-- ============================================================
ALTER TABLE "rlc_charter_onboarding" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON "rlc_charter_onboarding"
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE "rlc_charter_onboarding_steps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON "rlc_charter_onboarding_steps"
  FOR ALL USING (true) WITH CHECK (true);
