-- Create the organizational positions table (officers for charters)
-- This table was referenced by earlier rename migrations but never actually created.
-- Note: rlc_members.id and rlc_charters.id are TEXT, not UUID.
CREATE TABLE IF NOT EXISTS "rlc_organizational_positions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "contact_id" TEXT NOT NULL,
  "charter_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "committee_name" TEXT,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ended_at" TIMESTAMPTZ,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "appointed_by_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "rlc_organizational_positions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rlc_organizational_positions_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "rlc_members"("id") ON DELETE CASCADE,
  CONSTRAINT "rlc_organizational_positions_charter_id_fkey"
    FOREIGN KEY ("charter_id") REFERENCES "rlc_charters"("id") ON DELETE CASCADE,
  CONSTRAINT "rlc_organizational_positions_appointed_by_id_fkey"
    FOREIGN KEY ("appointed_by_id") REFERENCES "rlc_members"("id") ON DELETE SET NULL
);

-- Unique constraint: one person can hold a specific title+committee combo per charter at a time
CREATE UNIQUE INDEX IF NOT EXISTS "rlc_org_positions_contact_charter_title_committee"
  ON "rlc_organizational_positions" ("contact_id", "charter_id", "title", "committee_name");

-- Index for lookups by charter
CREATE INDEX IF NOT EXISTS "rlc_organizational_positions_charter_id_idx"
  ON "rlc_organizational_positions" ("charter_id");

-- Index for lookups by member
CREATE INDEX IF NOT EXISTS "rlc_organizational_positions_contact_id_idx"
  ON "rlc_organizational_positions" ("contact_id");

-- RLS: allow service role full access (admin API uses service role key)
ALTER TABLE "rlc_organizational_positions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON "rlc_organizational_positions"
  FOR ALL USING (true) WITH CHECK (true);
