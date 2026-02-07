-- ===========================================
-- CiviCRM Data Export Queries
-- ===========================================
-- Run these queries against the CiviCRM database to export data
-- for migration to the new RLC website.
--
-- IMPORTANT: Review data before running migration scripts.
-- These queries are for READ-ONLY export purposes.
-- ===========================================

-- -----------------------------------------
-- 1. Export Contacts
-- -----------------------------------------
SELECT
  c.id as civicrm_id,
  c.first_name,
  c.last_name,
  COALESCE(c.middle_name, '') as middle_name,
  c.organization_name,
  e.email as primary_email,
  p.phone as primary_phone,
  a.street_address as address_line1,
  a.supplemental_address_1 as address_line2,
  a.city,
  sp.abbreviation as state,
  a.postal_code,
  co.iso_code as country,
  c.do_not_email,
  c.do_not_phone,
  c.do_not_sms,
  c.is_opt_out as email_opt_out,
  c.created_date,
  c.modified_date
FROM civicrm_contact c
LEFT JOIN civicrm_email e ON c.id = e.contact_id AND e.is_primary = 1
LEFT JOIN civicrm_phone p ON c.id = p.contact_id AND p.is_primary = 1
LEFT JOIN civicrm_address a ON c.id = a.contact_id AND a.is_primary = 1
LEFT JOIN civicrm_state_province sp ON a.state_province_id = sp.id
LEFT JOIN civicrm_country co ON a.country_id = co.id
WHERE c.is_deleted = 0
  AND c.contact_type = 'Individual'
ORDER BY c.id;

-- -----------------------------------------
-- 2. Export Memberships
-- -----------------------------------------
SELECT
  m.id as civicrm_membership_id,
  m.contact_id as civicrm_contact_id,
  mt.name as membership_type_name,
  ms.name as membership_status,
  m.join_date,
  m.start_date,
  m.end_date,
  m.source,
  m.is_test,
  m.is_pay_later,
  m.contribution_recur_id,
  m.modified_date
FROM civicrm_membership m
JOIN civicrm_membership_type mt ON m.membership_type_id = mt.id
JOIN civicrm_membership_status ms ON m.status_id = ms.id
WHERE m.is_test = 0
ORDER BY m.contact_id, m.start_date DESC;

-- -----------------------------------------
-- 3. Export Contributions (Donations)
-- -----------------------------------------
SELECT
  c.id as civicrm_contribution_id,
  c.contact_id as civicrm_contact_id,
  c.total_amount,
  c.currency,
  c.receive_date,
  ft.name as financial_type,
  cs.name as contribution_status,
  c.payment_instrument_id,
  pi.label as payment_method,
  c.trxn_id as transaction_id,
  c.source,
  c.contribution_recur_id,
  c.is_test,
  c.campaign_id
FROM civicrm_contribution c
JOIN civicrm_financial_type ft ON c.financial_type_id = ft.id
JOIN civicrm_contribution_status cs ON c.contribution_status_id = cs.id
LEFT JOIN civicrm_option_value pi ON c.payment_instrument_id = pi.value
  AND pi.option_group_id = (SELECT id FROM civicrm_option_group WHERE name = 'payment_instrument')
WHERE c.is_test = 0
ORDER BY c.contact_id, c.receive_date DESC;

-- -----------------------------------------
-- 4. Export Events
-- -----------------------------------------
SELECT
  e.id as civicrm_event_id,
  e.title,
  e.summary,
  e.description,
  e.event_type_id,
  et.label as event_type,
  e.start_date,
  e.end_date,
  e.is_online_registration,
  e.registration_link_text,
  e.max_participants,
  e.is_map,
  e.is_active,
  e.is_public,
  loc.name as location_name,
  addr.street_address as location_address,
  addr.city as location_city,
  sp.abbreviation as location_state,
  addr.postal_code as location_postal_code,
  e.fee_label,
  e.is_monetary,
  e.created_date
FROM civicrm_event e
LEFT JOIN civicrm_option_value et ON e.event_type_id = et.value
  AND et.option_group_id = (SELECT id FROM civicrm_option_group WHERE name = 'event_type')
LEFT JOIN civicrm_loc_block lb ON e.loc_block_id = lb.id
LEFT JOIN civicrm_address addr ON lb.address_id = addr.id
LEFT JOIN civicrm_state_province sp ON addr.state_province_id = sp.id
LEFT JOIN civicrm_email loc_email ON lb.email_id = loc_email.id
LEFT JOIN civicrm_phone loc_phone ON lb.phone_id = loc_phone.id
LEFT JOIN (
  SELECT contact_id, display_name as name FROM civicrm_contact WHERE id IN (
    SELECT DISTINCT contact_id FROM civicrm_address WHERE id IN (
      SELECT address_id FROM civicrm_loc_block
    )
  )
) loc ON addr.contact_id = loc.contact_id
WHERE e.is_template = 0
ORDER BY e.start_date DESC;

-- -----------------------------------------
-- 5. Export Event Registrations (Participants)
-- -----------------------------------------
SELECT
  p.id as civicrm_participant_id,
  p.event_id as civicrm_event_id,
  p.contact_id as civicrm_contact_id,
  ps.name as participant_status,
  pr.name as participant_role,
  p.register_date,
  p.source,
  p.fee_level,
  p.fee_amount,
  p.fee_currency,
  p.is_test,
  p.registered_by_id
FROM civicrm_participant p
JOIN civicrm_participant_status_type ps ON p.status_id = ps.id
LEFT JOIN civicrm_option_value pr ON p.role_id = pr.value
  AND pr.option_group_id = (SELECT id FROM civicrm_option_group WHERE name = 'participant_role')
WHERE p.is_test = 0
ORDER BY p.event_id, p.register_date;

-- -----------------------------------------
-- 6. Export Groups (for State Chapters)
-- -----------------------------------------
SELECT
  g.id as civicrm_group_id,
  g.name,
  g.title,
  g.description,
  g.is_active,
  g.group_type,
  g.created_date,
  (SELECT COUNT(*) FROM civicrm_group_contact gc WHERE gc.group_id = g.id AND gc.status = 'Added') as member_count
FROM civicrm_group g
WHERE g.is_active = 1
  AND (g.title LIKE '%RLC%' OR g.title LIKE '%Chapter%' OR g.name LIKE '%state%')
ORDER BY g.title;

-- -----------------------------------------
-- 7. Export Group Contacts (Chapter Memberships)
-- -----------------------------------------
SELECT
  gc.group_id as civicrm_group_id,
  gc.contact_id as civicrm_contact_id,
  gc.status,
  g.title as group_title
FROM civicrm_group_contact gc
JOIN civicrm_group g ON gc.group_id = g.id
WHERE gc.status = 'Added'
  AND g.is_active = 1
ORDER BY gc.group_id, gc.contact_id;

-- -----------------------------------------
-- 8. Summary Statistics (for validation)
-- -----------------------------------------
SELECT 'contacts' as entity, COUNT(*) as count
FROM civicrm_contact WHERE is_deleted = 0 AND contact_type = 'Individual'
UNION ALL
SELECT 'memberships', COUNT(*)
FROM civicrm_membership WHERE is_test = 0
UNION ALL
SELECT 'contributions', COUNT(*)
FROM civicrm_contribution WHERE is_test = 0
UNION ALL
SELECT 'contribution_total', SUM(total_amount)
FROM civicrm_contribution WHERE is_test = 0 AND contribution_status_id = 1
UNION ALL
SELECT 'events', COUNT(*)
FROM civicrm_event WHERE is_template = 0
UNION ALL
SELECT 'participants', COUNT(*)
FROM civicrm_participant WHERE is_test = 0
UNION ALL
SELECT 'groups', COUNT(*)
FROM civicrm_group WHERE is_active = 1;
