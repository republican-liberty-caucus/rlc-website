-- Migration: Create rlc_webhook_events table for Stripe webhook idempotency (issue #54)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lbwqtrymxjbllaqystwr/sql

CREATE TABLE IF NOT EXISTS rlc_webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Unique constraint prevents duplicate event processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id
  ON rlc_webhook_events (stripe_event_id);

-- Auto-cleanup: events older than 30 days are safe to remove
-- (Stripe's replay window is 300 seconds, this is belt-and-suspenders)
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
  ON rlc_webhook_events (created_at);

-- RLS: service role only (webhooks use service role key)
ALTER TABLE rlc_webhook_events ENABLE ROW LEVEL SECURITY;
