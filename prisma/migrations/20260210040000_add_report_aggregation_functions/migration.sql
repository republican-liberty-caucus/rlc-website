-- Report aggregation functions: move counting from JS (truncated at 1000 rows) to PostgreSQL

-- 1. Members by tier (snapshot)
CREATE OR REPLACE FUNCTION get_members_by_tier(p_charter_ids TEXT[] DEFAULT NULL)
RETURNS TABLE(membership_tier "MembershipTier", count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT m.membership_tier, COUNT(*) AS count
  FROM rlc_members m
  WHERE (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.membership_tier
  ORDER BY count DESC;
$$;

-- 2. Members by status (snapshot — also used for retention calc)
CREATE OR REPLACE FUNCTION get_members_by_status(p_charter_ids TEXT[] DEFAULT NULL)
RETURNS TABLE(membership_status "MembershipStatus", count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT m.membership_status, COUNT(*) AS count
  FROM rlc_members m
  WHERE (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.membership_status
  ORDER BY count DESC;
$$;

-- 3. Members by charter (with charter name)
CREATE OR REPLACE FUNCTION get_members_by_charter(p_charter_ids TEXT[] DEFAULT NULL)
RETURNS TABLE(charter_id TEXT, charter_name TEXT, count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT m.primary_charter_id, c.name, COUNT(*) AS count
  FROM rlc_members m
  JOIN rlc_charters c ON c.id = m.primary_charter_id
  WHERE m.primary_charter_id IS NOT NULL
    AND (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.primary_charter_id, c.name
  ORDER BY count DESC;
$$;

-- 4. Contributions by type (date-scoped, with totals)
CREATE OR REPLACE FUNCTION get_contribution_summary(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_charter_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE(contribution_type "ContributionType", count BIGINT, total_amount NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT c.contribution_type, COUNT(*) AS count, COALESCE(SUM(c.amount), 0) AS total_amount
  FROM rlc_contributions c
  WHERE c.payment_status = 'completed'
    AND c.created_at >= p_start_date
    AND c.created_at <= p_end_date
    AND (p_charter_ids IS NULL OR c.charter_id = ANY(p_charter_ids))
  GROUP BY c.contribution_type
  ORDER BY total_amount DESC;
$$;

-- Supporting indexes for the aggregation queries
CREATE INDEX IF NOT EXISTS idx_rlc_members_primary_charter_id ON rlc_members(primary_charter_id);
CREATE INDEX IF NOT EXISTS idx_rlc_members_membership_tier ON rlc_members(membership_tier);
CREATE INDEX IF NOT EXISTS idx_rlc_members_membership_status ON rlc_members(membership_status);
CREATE INDEX IF NOT EXISTS idx_rlc_contributions_charter_id ON rlc_contributions(charter_id);
CREATE INDEX IF NOT EXISTS idx_rlc_contributions_status_created ON rlc_contributions(payment_status, created_at);
