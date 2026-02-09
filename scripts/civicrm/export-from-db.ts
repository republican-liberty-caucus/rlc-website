/**
 * CiviCRM Database Export Script
 *
 * Connects directly to the CiviCRM MySQL database and exports data to JSON files.
 *
 * Usage:
 *   pnpm export:civicrm              # Export all datasets
 *   pnpm export:civicrm --contacts   # Export contacts only
 *   pnpm export:civicrm --stats      # Show stats only (no export)
 */

import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load CiviCRM database credentials
const envPath = path.join(__dirname, '.env.civicrm');
if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env.civicrm file not found!');
  console.error('Please create scripts/civicrm/.env.civicrm with database credentials.');
  process.exit(1);
}

dotenv.config({ path: envPath });

const config = {
  host: process.env.CIVICRM_DB_HOST || 'localhost',
  port: parseInt(process.env.CIVICRM_DB_PORT || '3306', 10),
  user: process.env.CIVICRM_DB_USER!,
  password: process.env.CIVICRM_DB_PASSWORD!,
  database: process.env.CIVICRM_DB_NAME!,
};

// Validate config
if (!config.user || !config.password || !config.database) {
  console.error('ERROR: Missing required database credentials in .env.civicrm');
  console.error('Required: CIVICRM_DB_USER, CIVICRM_DB_PASSWORD, CIVICRM_DB_NAME');
  process.exit(1);
}

// ===========================================
// SQL Queries (from export-queries.sql)
// ===========================================

const QUERIES = {
  contacts: `
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
  AND (
    c.id IN (SELECT DISTINCT contact_id FROM civicrm_membership WHERE is_test = 0)
    OR c.id IN (SELECT DISTINCT contact_id FROM civicrm_contribution WHERE is_test = 0)
  )
ORDER BY c.id
  `,

  memberships: `
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
  m.contribution_recur_id
FROM civicrm_membership m
JOIN civicrm_membership_type mt ON m.membership_type_id = mt.id
JOIN civicrm_membership_status ms ON m.status_id = ms.id
WHERE m.is_test = 0
ORDER BY m.contact_id, m.start_date DESC
  `,

  contributions: `
SELECT
  c.id as civicrm_contribution_id,
  c.contact_id as civicrm_contact_id,
  c.total_amount,
  c.currency,
  c.receive_date,
  ft.name as financial_type,
  cs.label as contribution_status,
  c.payment_instrument_id,
  pi.label as payment_method,
  c.trxn_id as transaction_id,
  c.source,
  c.contribution_recur_id,
  c.is_test,
  c.campaign_id
FROM civicrm_contribution c
JOIN civicrm_financial_type ft ON c.financial_type_id = ft.id
LEFT JOIN civicrm_option_value cs ON c.contribution_status_id = cs.value
  AND cs.option_group_id = (SELECT id FROM civicrm_option_group WHERE name = 'contribution_status')
LEFT JOIN civicrm_option_value pi ON c.payment_instrument_id = pi.value
  AND pi.option_group_id = (SELECT id FROM civicrm_option_group WHERE name = 'payment_instrument')
WHERE c.is_test = 0
ORDER BY c.contact_id, c.receive_date DESC
  `,

  groups: `
SELECT
  g.id as civicrm_group_id,
  g.name,
  g.title,
  g.description,
  g.is_active,
  g.group_type,
  (SELECT COUNT(*) FROM civicrm_group_contact gc WHERE gc.group_id = g.id AND gc.status = 'Added') as member_count
FROM civicrm_group g
WHERE g.is_active = 1
  AND (g.title LIKE '%RLC%' OR g.title LIKE '%Chapter%' OR g.name LIKE '%state%'
       OR g.title LIKE '%Republican Liberty%' OR g.title LIKE '%Caucus%')
ORDER BY g.title
  `,

  group_contacts: `
SELECT
  gc.group_id as civicrm_group_id,
  gc.contact_id as civicrm_contact_id,
  gc.status,
  g.title as group_title
FROM civicrm_group_contact gc
JOIN civicrm_group g ON gc.group_id = g.id
WHERE gc.status = 'Added'
  AND g.is_active = 1
ORDER BY gc.group_id, gc.contact_id
  `,

  relationships: `
SELECT
  r.id,
  r.contact_id_a,
  r.contact_id_b,
  rt.name_a_b,
  rt.name_b_a
FROM civicrm_relationship r
JOIN civicrm_relationship_type rt ON r.relationship_type_id = rt.id
WHERE rt.name_a_b IN ('Spouse of', 'Child of', 'Head of Household for', 'Sibling of')
  AND r.is_active = 1
ORDER BY r.contact_id_a
  `,

  stats: `
SELECT 'contacts_with_membership' as entity, COUNT(DISTINCT m.contact_id) as count
FROM civicrm_membership m WHERE m.is_test = 0
UNION ALL
SELECT 'contacts_with_contribution', COUNT(DISTINCT c.contact_id)
FROM civicrm_contribution c WHERE c.is_test = 0
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
SELECT 'groups', COUNT(*)
FROM civicrm_group WHERE is_active = 1
UNION ALL
SELECT 'relationships', COUNT(*)
FROM civicrm_relationship WHERE is_active = 1
  `,
};

// ===========================================
// Export Functions
// ===========================================

async function exportDataset(
  connection: mysql.Connection,
  name: string,
  query: string
): Promise<number> {
  console.log(`\nExporting ${name}...`);

  try {
    const [rows] = await connection.execute(query);
    const records = rows as any[];

    console.log(`  Found ${records.length} records`);

    // Save to JSON file
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filename = `${name}.json`;
    const filepath = path.join(dataDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(records, null, 2));

    console.log(`  Saved to ${filename}`);
    return records.length;
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return 0;
  }
}

async function showStats(connection: mysql.Connection): Promise<void> {
  console.log('\n=== CiviCRM Database Statistics ===\n');

  try {
    const [rows] = await connection.execute(QUERIES.stats);
    const stats = rows as { entity: string; count: number }[];

    for (const stat of stats) {
      const label = stat.entity.replace(/_/g, ' ');
      const value = stat.entity === 'contribution_total'
        ? `$${stat.count.toFixed(2)}`
        : stat.count.toLocaleString();
      console.log(`  ${label}: ${value}`);
    }
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ===========================================
// Main
// ===========================================

async function main() {
  const args = process.argv.slice(2);
  const statsOnly = args.includes('--stats');
  const contactsOnly = args.includes('--contacts');

  console.log('===========================================');
  console.log('CiviCRM Database Export');
  console.log('===========================================');
  console.log(`\nConnecting to: ${config.database} @ ${config.host}:${config.port}`);
  console.log(`User: ${config.user}\n`);

  let connection: mysql.Connection | null = null;

  try {
    // Connect to database
    connection = await mysql.createConnection(config);
    console.log('✓ Connected to database\n');

    // Show stats
    await showStats(connection);

    if (statsOnly) {
      console.log('\n===========================================');
      console.log('Stats Only Mode - No Export Performed');
      console.log('===========================================');
      return;
    }

    console.log('\n=== Starting Export ===');

    const results: Record<string, number> = {};

    if (contactsOnly) {
      results.contacts = await exportDataset(connection, 'contacts', QUERIES.contacts);
    } else {
      // Export all datasets
      results.contacts = await exportDataset(connection, 'contacts', QUERIES.contacts);
      results.memberships = await exportDataset(connection, 'memberships', QUERIES.memberships);
      results.contributions = await exportDataset(connection, 'contributions', QUERIES.contributions);
      results.groups = await exportDataset(connection, 'groups', QUERIES.groups);
      results.group_contacts = await exportDataset(connection, 'group_contacts', QUERIES.group_contacts);
      results.relationships = await exportDataset(connection, 'relationships', QUERIES.relationships);
    }

    console.log('\n=== Export Summary ===\n');
    for (const [name, count] of Object.entries(results)) {
      console.log(`  ${name}: ${count} records`);
    }

    console.log('\n===========================================');
    console.log('Export Complete');
    console.log('Files saved to: scripts/civicrm/data/');
    console.log('===========================================');

  } catch (error) {
    console.error('\n===========================================');
    console.error('ERROR:', error instanceof Error ? error.message : 'Unknown error');
    console.error('===========================================');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main().catch(console.error);
