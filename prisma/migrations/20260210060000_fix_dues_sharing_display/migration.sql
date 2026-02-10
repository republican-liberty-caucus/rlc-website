-- Fix dues-sharing display bugs (PostgREST max_rows=1000 cap) and backfill data quality
-- Adds 3 RPC functions, fixes 14,717 backfill entry timestamps/statuses, includes rollback

--------------------------------------------------------------------------------
-- 1. RPC: get_ledger_entry_count (replaces count: 'exact' in audit route)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_ledger_entry_count(
  p_charter_ids TEXT[] DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_contribution_id TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)
  FROM rlc_split_ledger_entries le
  WHERE (p_charter_ids IS NULL OR le.recipient_charter_id = ANY(p_charter_ids))
    AND (p_status IS NULL OR le.status = p_status::"SplitLedgerStatus")
    AND (p_contribution_id IS NULL OR le.contribution_id = p_contribution_id);
$$;

--------------------------------------------------------------------------------
-- 2. RPC: get_ledger_summary (replaces JS aggregation on overview page)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_ledger_summary(p_charter_ids TEXT[] DEFAULT NULL)
RETURNS TABLE(
  total_distributed NUMERIC,
  total_pending NUMERIC,
  monthly_distributed NUMERIC,
  entry_count BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(SUM(CASE WHEN le.status = 'transferred' THEN le.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN le.status = 'pending' THEN le.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN le.status = 'transferred'
      AND le.created_at >= date_trunc('month', now()) THEN le.amount ELSE 0 END), 0),
    COUNT(*)
  FROM rlc_split_ledger_entries le
  WHERE le.amount > 0
    AND (p_charter_ids IS NULL OR le.recipient_charter_id = ANY(p_charter_ids));
$$;

--------------------------------------------------------------------------------
-- 3. RPC: get_top_receiving_charters (replaces JS charter totals calculation)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_top_receiving_charters(
  p_charter_ids TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(charter_id TEXT, charter_name TEXT, total_amount NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT le.recipient_charter_id, c.name, SUM(le.amount)
  FROM rlc_split_ledger_entries le
  JOIN rlc_charters c ON c.id = le.recipient_charter_id
  WHERE le.amount > 0
    AND (p_charter_ids IS NULL OR le.recipient_charter_id = ANY(p_charter_ids))
  GROUP BY le.recipient_charter_id, c.name
  ORDER BY SUM(le.amount) DESC
  LIMIT p_limit;
$$;

--------------------------------------------------------------------------------
-- 4. Safety checks before backfill data fix
--------------------------------------------------------------------------------

-- Safety check: verify backfill entries only link to membership contributions
DO $$
DECLARE
  non_membership_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO non_membership_count
  FROM rlc_split_ledger_entries le
  JOIN rlc_contributions c ON c.id = le.contribution_id
  WHERE (le.split_rule_snapshot->>'backfill')::boolean = true
    AND c.contribution_type != 'membership';

  IF non_membership_count > 0 THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: Found % backfill entries linked to non-membership contributions. Aborting migration.', non_membership_count;
  END IF;
END $$;

-- Safety check: verify no contribution has BOTH original and backfill entries
DO $$
DECLARE
  overlap_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO overlap_count
  FROM (
    SELECT contribution_id
    FROM rlc_split_ledger_entries
    WHERE (split_rule_snapshot->>'backfill')::boolean = true
    INTERSECT
    SELECT contribution_id
    FROM rlc_split_ledger_entries
    WHERE split_rule_snapshot->>'backfill' IS NULL
  ) overlap_set;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: Found % contributions with both original and backfill entries. Aborting migration.', overlap_count;
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 5. Backfill data fix: timestamps and statuses
--------------------------------------------------------------------------------

-- Fix ALL backfill entries: set created_at to the contribution's historical date
UPDATE rlc_split_ledger_entries le
SET created_at = c.created_at
FROM rlc_contributions c
WHERE le.contribution_id = c.id
  AND (le.split_rule_snapshot->>'backfill')::boolean = true;

-- Fix state remainder entries: mark as transferred with historical date
UPDATE rlc_split_ledger_entries le
SET
  status = 'transferred',
  transferred_at = c.created_at
FROM rlc_contributions c
WHERE le.contribution_id = c.id
  AND (le.split_rule_snapshot->>'backfill')::boolean = true
  AND (le.split_rule_snapshot->>'state_remainder')::boolean = true;

-- Fix national backfill entries: set transferred_at to historical date
UPDATE rlc_split_ledger_entries le
SET transferred_at = c.created_at
FROM rlc_contributions c
WHERE le.contribution_id = c.id
  AND (le.split_rule_snapshot->>'backfill')::boolean = true
  AND le.split_rule_snapshot->>'state_remainder' IS NULL;

--------------------------------------------------------------------------------
-- 6. Rollback function (call SELECT * FROM rollback_backfill_data_fix() to revert)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rollback_backfill_data_fix()
RETURNS TABLE(national_reverted BIGINT, state_reverted BIGINT)
LANGUAGE plpgsql AS $$
DECLARE
  v_national BIGINT;
  v_state BIGINT;
BEGIN
  -- Revert national backfill entries
  UPDATE rlc_split_ledger_entries
  SET
    created_at = '2026-02-10T15:58:33.317Z'::timestamptz,
    transferred_at = NULL
  WHERE (split_rule_snapshot->>'backfill')::boolean = true
    AND split_rule_snapshot->>'state_remainder' IS NULL;
  GET DIAGNOSTICS v_national = ROW_COUNT;

  -- Revert state remainder entries
  UPDATE rlc_split_ledger_entries
  SET
    created_at = '2026-02-10T15:59:14.756Z'::timestamptz,
    status = 'pending',
    transferred_at = NULL
  WHERE (split_rule_snapshot->>'backfill')::boolean = true
    AND (split_rule_snapshot->>'state_remainder')::boolean = true;
  GET DIAGNOSTICS v_state = ROW_COUNT;

  RETURN QUERY SELECT v_national, v_state;
END $$;
