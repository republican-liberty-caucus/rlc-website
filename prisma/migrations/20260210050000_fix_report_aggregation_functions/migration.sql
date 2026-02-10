-- Fix report aggregation functions:
-- 1. Filter get_members_by_tier to current members only
-- 2. Filter get_members_by_charter to current members only
-- 3. Add get_new_members_count using membership_join_date (not created_at)
-- 4. Add index on membership_join_date

-- 1. Members by tier — current members only
CREATE OR REPLACE FUNCTION get_members_by_tier(p_charter_ids TEXT[] DEFAULT NULL)
RETURNS TABLE(membership_tier "MembershipTier", count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT m.membership_tier, COUNT(*) AS count
  FROM rlc_members m
  WHERE m.membership_status = 'current'
    AND (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.membership_tier
  ORDER BY count DESC;
$$;

-- 2. Members by charter — current members only
CREATE OR REPLACE FUNCTION get_members_by_charter(p_charter_ids TEXT[] DEFAULT NULL)
RETURNS TABLE(charter_id TEXT, charter_name TEXT, count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT m.primary_charter_id, c.name, COUNT(*) AS count
  FROM rlc_members m
  JOIN rlc_charters c ON c.id = m.primary_charter_id
  WHERE m.primary_charter_id IS NOT NULL
    AND m.membership_status = 'current'
    AND (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.primary_charter_id, c.name
  ORDER BY count DESC;
$$;

-- 3. New members count using membership_join_date
CREATE OR REPLACE FUNCTION get_new_members_count(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_charter_ids TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)
  FROM rlc_members m
  WHERE m.membership_join_date >= p_start_date
    AND m.membership_join_date <= p_end_date
    AND (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids));
$$;

-- 4. Index for membership_join_date queries
CREATE INDEX IF NOT EXISTS idx_rlc_members_membership_join_date ON rlc_members(membership_join_date);
