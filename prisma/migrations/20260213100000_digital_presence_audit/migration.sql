-- Phase 3: Digital Presence Audit tables
-- Stores automated audit results for candidate vetting pipeline

-- 1. AuditStatus enum
CREATE TYPE "AuditStatus" AS ENUM ('audit_pending', 'running', 'audit_completed', 'audit_failed');

-- 2. CandidateDigitalAudit — one audit per vetting run
CREATE TABLE "rlc_candidate_digital_audits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vetting_id" UUID NOT NULL REFERENCES "rlc_candidate_vettings"("id") ON DELETE CASCADE,
  "status" "AuditStatus" NOT NULL DEFAULT 'audit_pending',
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "triggered_by_id" UUID REFERENCES "rlc_members"("id"),
  "candidate_overall_score" INTEGER,
  "candidate_grade" TEXT,
  "candidate_score_breakdown" JSONB,
  "candidate_risks" JSONB,
  "opponent_audits" JSONB,
  "discovery_log" JSONB,
  "screenshots_manifest" JSONB,
  "error_message" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_digital_audits_vetting" ON "rlc_candidate_digital_audits" ("vetting_id");

-- Prevent duplicate in-progress audits per vetting
CREATE UNIQUE INDEX "idx_digital_audits_active_per_vetting"
  ON "rlc_candidate_digital_audits" ("vetting_id")
  WHERE "status" IN ('audit_pending', 'running');

-- 3. CandidateAuditPlatform — per-platform results
CREATE TABLE "rlc_candidate_audit_platforms" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "audit_id" UUID NOT NULL REFERENCES "rlc_candidate_digital_audits"("id") ON DELETE CASCADE,
  "entity_type" TEXT NOT NULL,
  "entity_name" TEXT NOT NULL,
  "platform_name" TEXT NOT NULL,
  "platform_url" TEXT,
  "confidence_score" DECIMAL(3,2),
  "discovery_method" TEXT,
  "activity_status" TEXT,
  "last_activity_date" TIMESTAMPTZ,
  "followers" INTEGER,
  "engagement_rate" DECIMAL(5,2),
  "screenshot_desktop_url" TEXT,
  "screenshot_mobile_url" TEXT,
  "score_presence" INTEGER,
  "score_consistency" INTEGER,
  "score_quality" INTEGER,
  "score_accessibility" INTEGER,
  "total_score" INTEGER,
  "grade" TEXT,
  "contact_methods" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "idx_audit_platforms_audit_entity" ON "rlc_candidate_audit_platforms" ("audit_id", "entity_type");
