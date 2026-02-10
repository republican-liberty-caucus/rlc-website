-- Backfill primary_charter_id for members who have a state but no charter assigned.
-- Matches rlc_members.state to rlc_charters.state_code where charter_level = 'state'.
UPDATE rlc_members m
SET primary_charter_id = c.id,
    updated_at = now()
FROM rlc_charters c
WHERE m.state = c.state_code
  AND c.charter_level = 'state'
  AND m.primary_charter_id IS NULL
  AND m.state IS NOT NULL;

-- Update contributions that reference these members but have NULL charter_id.
-- This ensures existing contributions get attributed to the correct charter
-- so dues splits can be recalculated.
UPDATE rlc_contributions cont
SET charter_id = m.primary_charter_id
FROM rlc_members m
WHERE cont.contact_id = m.id
  AND cont.charter_id IS NULL
  AND m.primary_charter_id IS NOT NULL
  AND cont.contribution_type = 'membership';

-- Delete existing ledger entries for contributions that now have a charter_id,
-- so processDuesSplit can reprocess them with correct state/national splits.
-- Only delete entries for contributions whose charter_id was just backfilled
-- (these were all "100% National" because charter_id was NULL).
DELETE FROM rlc_split_ledger_entries sle
USING rlc_contributions cont, rlc_members m
WHERE sle.contribution_id = cont.id
  AND cont.contact_id = m.id
  AND m.primary_charter_id IS NOT NULL
  AND cont.charter_id = m.primary_charter_id
  AND cont.contribution_type = 'membership';
