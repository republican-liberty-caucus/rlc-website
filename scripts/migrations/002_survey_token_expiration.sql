-- Migration: Add token_expires_at to rlc_candidate_responses (issue #55)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lbwqtrymxjbllaqystwr/sql

ALTER TABLE rlc_candidate_responses
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- Set existing tokens to expire 90 days from now (one-time backfill)
UPDATE rlc_candidate_responses
  SET token_expires_at = now() + interval '90 days'
  WHERE token_expires_at IS NULL AND status = 'pending';
