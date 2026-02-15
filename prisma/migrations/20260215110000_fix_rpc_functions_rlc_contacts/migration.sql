-- Fix RPC functions that still referenced rlc_members after table rename
-- These functions are called by the admin dashboard and reports pages

CREATE OR REPLACE FUNCTION public.get_members_by_charter(p_charter_ids text[] DEFAULT NULL::text[])
 RETURNS TABLE(charter_id text, charter_name text, count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT m.primary_charter_id, c.name, COUNT(*) AS count
  FROM rlc_contacts m
  JOIN rlc_charters c ON c.id = m.primary_charter_id
  WHERE m.primary_charter_id IS NOT NULL
    AND m.membership_status = 'current'
    AND (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.primary_charter_id, c.name
  ORDER BY count DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_members_by_status(p_charter_ids text[] DEFAULT NULL::text[])
 RETURNS TABLE(membership_status "MembershipStatus", count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT m.membership_status, COUNT(*) AS count
  FROM rlc_contacts m
  WHERE (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.membership_status
  ORDER BY count DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_members_by_tier(p_charter_ids text[] DEFAULT NULL::text[])
 RETURNS TABLE(membership_tier "MembershipTier", count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT m.membership_tier, COUNT(*) AS count
  FROM rlc_contacts m
  WHERE m.membership_status = 'current'
    AND (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids))
  GROUP BY m.membership_tier
  ORDER BY count DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_new_members_count(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_charter_ids text[] DEFAULT NULL::text[])
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COUNT(*)
  FROM rlc_contacts m
  WHERE m.membership_join_date >= p_start_date
    AND m.membership_join_date <= p_end_date
    AND (p_charter_ids IS NULL OR m.primary_charter_id = ANY(p_charter_ids));
$function$;
