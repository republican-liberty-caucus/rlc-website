-- Share kits: one per promotable content item
CREATE TABLE "rlc_share_kits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "content_type" TEXT NOT NULL,
  "content_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "social_copy" JSONB NOT NULL DEFAULT '{}',
  "og_image_url" TEXT,
  "og_image_override_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "scope" TEXT NOT NULL DEFAULT 'national',
  "charter_id" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "rlc_share_kits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rlc_share_kits_charter_id_fkey" FOREIGN KEY ("charter_id") REFERENCES "rlc_charters"("id") ON DELETE SET NULL,
  CONSTRAINT "rlc_share_kits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "rlc_members"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "rlc_share_kits_content_type_content_id_key" ON "rlc_share_kits"("content_type", "content_id");
CREATE INDEX "idx_share_kits_status" ON "rlc_share_kits"("status");

-- Tracked links: one per member per share kit
CREATE TABLE "rlc_share_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "share_kit_id" UUID NOT NULL,
  "member_id" TEXT NOT NULL,
  "short_code" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "rlc_share_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rlc_share_links_share_kit_id_fkey" FOREIGN KEY ("share_kit_id") REFERENCES "rlc_share_kits"("id") ON DELETE CASCADE,
  CONSTRAINT "rlc_share_links_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "rlc_members"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "rlc_share_links_short_code_key" ON "rlc_share_links"("short_code");
CREATE UNIQUE INDEX "rlc_share_links_kit_member_key" ON "rlc_share_links"("share_kit_id", "member_id");
CREATE INDEX "idx_share_links_member" ON "rlc_share_links"("member_id");

-- Click tracking
CREATE TABLE "rlc_link_clicks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "share_link_id" UUID NOT NULL,
  "clicked_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "referrer" TEXT,
  "user_agent" TEXT,
  "geo_state" TEXT,

  CONSTRAINT "rlc_link_clicks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rlc_link_clicks_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "rlc_share_links"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_link_clicks_link" ON "rlc_link_clicks"("share_link_id");
CREATE INDEX "idx_link_clicks_time" ON "rlc_link_clicks"("clicked_at");

-- Share events (which platform, when)
CREATE TABLE "rlc_share_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "share_link_id" UUID NOT NULL,
  "platform" TEXT NOT NULL,
  "shared_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "rlc_share_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rlc_share_events_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "rlc_share_links"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_share_events_link" ON "rlc_share_events"("share_link_id");
