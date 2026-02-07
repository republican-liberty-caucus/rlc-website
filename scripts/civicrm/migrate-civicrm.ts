/**
 * CiviCRM to Supabase Migration Script
 *
 * Usage:
 *   pnpm migrate:civicrm              # Run full migration
 *   pnpm migrate:civicrm --dry-run    # Validate without writing
 *   pnpm migrate:civicrm --contacts   # Migrate only contacts
 *   pnpm migrate:civicrm --validate   # Run validation only
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Type definitions
interface CiviCRMContact {
  civicrm_id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  primary_email: string;
  primary_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  do_not_email?: boolean;
  email_opt_out?: boolean;
  created_date: string;
}

interface CiviCRMMembership {
  civicrm_membership_id: number;
  civicrm_contact_id: number;
  membership_type_name: string;
  membership_status: string;
  join_date?: string;
  start_date?: string;
  end_date?: string;
}

interface CiviCRMContribution {
  civicrm_contribution_id: number;
  civicrm_contact_id: number;
  total_amount: number;
  currency: string;
  receive_date: string;
  financial_type: string;
  contribution_status: string;
}

// Mapping configurations
const membershipTypeMapping: Record<string, string> = {
  General: 'member',
  Sustaining: 'sustaining',
  Lifetime: 'lifetime',
  'Board Member': 'leadership',
  Student: 'supporter',
  // Add more mappings as needed
};

const membershipStatusMapping: Record<string, string> = {
  New: 'pending',
  Current: 'active',
  Grace: 'active',
  Expired: 'expired',
  Cancelled: 'cancelled',
  Deceased: 'cancelled',
  Pending: 'pending',
};

const contributionTypeMapping: Record<string, string> = {
  'Member Dues': 'membership',
  Donation: 'donation',
  'Event Fee': 'event_registration',
};

// Migration functions
async function migrateContacts(
  contacts: CiviCRMContact[],
  dryRun: boolean = false
): Promise<{ success: number; failed: number; errors: string[] }> {
  console.log(`\nMigrating ${contacts.length} contacts...`);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const contact of contacts) {
    try {
      const memberData = {
        email: contact.primary_email?.toLowerCase().trim(),
        first_name: contact.first_name || 'Unknown',
        last_name: contact.last_name || 'User',
        phone: contact.primary_phone || null,
        address_line1: contact.address_line1 || null,
        address_line2: contact.address_line2 || null,
        city: contact.city || null,
        state: contact.state || null,
        postal_code: contact.postal_code || null,
        country: contact.country || 'US',
        email_opt_in: !contact.email_opt_out && !contact.do_not_email,
        civicrm_contact_id: contact.civicrm_id,
        membership_tier: 'supporter' as const,
        membership_status: 'pending' as const,
      };

      if (!memberData.email) {
        errors.push(`Contact ${contact.civicrm_id}: Missing email`);
        failed++;
        continue;
      }

      if (!dryRun) {
        const { error } = await supabase.from('rlc_members').upsert(memberData, {
          onConflict: 'civicrm_contact_id',
        });

        if (error) {
          throw error;
        }

        // Log migration
        await supabase.from('rlc_civicrm_migration_log').insert({
          entity_type: 'contact',
          civicrm_id: contact.civicrm_id,
          status: 'completed',
          migrated_at: new Date().toISOString(),
        });
      }

      success++;

      if (success % 100 === 0) {
        console.log(`  Processed ${success} contacts...`);
      }
    } catch (error) {
      failed++;
      errors.push(
        `Contact ${contact.civicrm_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return { success, failed, errors };
}

async function migrateMemberships(
  memberships: CiviCRMMembership[],
  dryRun: boolean = false
): Promise<{ success: number; failed: number; errors: string[] }> {
  console.log(`\nMigrating ${memberships.length} memberships...`);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const membership of memberships) {
    try {
      // Find the member by CiviCRM contact ID
      const { data: member } = await supabase
        .from('rlc_members')
        .select('id')
        .eq('civicrm_contact_id', membership.civicrm_contact_id)
        .single();

      if (!member) {
        errors.push(
          `Membership ${membership.civicrm_membership_id}: Member not found for contact ${membership.civicrm_contact_id}`
        );
        failed++;
        continue;
      }

      const tier = membershipTypeMapping[membership.membership_type_name] || 'member';
      const status = membershipStatusMapping[membership.membership_status] || 'pending';

      if (!dryRun) {
        const { error } = await supabase
          .from('rlc_members')
          .update({
            membership_tier: tier,
            membership_status: status,
            membership_start_date: membership.start_date || membership.join_date,
            membership_expiry_date: membership.end_date,
          })
          .eq('id', member.id);

        if (error) {
          throw error;
        }
      }

      success++;
    } catch (error) {
      failed++;
      errors.push(
        `Membership ${membership.civicrm_membership_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return { success, failed, errors };
}

async function migrateContributions(
  contributions: CiviCRMContribution[],
  dryRun: boolean = false
): Promise<{ success: number; failed: number; errors: string[] }> {
  console.log(`\nMigrating ${contributions.length} contributions...`);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const contribution of contributions) {
    try {
      // Find the member by CiviCRM contact ID
      const { data: member } = await supabase
        .from('rlc_members')
        .select('id')
        .eq('civicrm_contact_id', contribution.civicrm_contact_id)
        .single();

      if (!member) {
        errors.push(
          `Contribution ${contribution.civicrm_contribution_id}: Member not found for contact ${contribution.civicrm_contact_id}`
        );
        failed++;
        continue;
      }

      const contributionType =
        contributionTypeMapping[contribution.financial_type] || 'donation';
      const paymentStatus =
        contribution.contribution_status === 'Completed' ? 'completed' : 'pending';

      if (!dryRun) {
        const { error } = await supabase.from('rlc_contributions').insert({
          member_id: member.id,
          contribution_type: contributionType,
          amount: contribution.total_amount,
          currency: contribution.currency || 'USD',
          payment_status: paymentStatus,
          civicrm_contribution_id: contribution.civicrm_contribution_id,
          created_at: contribution.receive_date,
        });

        if (error) {
          throw error;
        }
      }

      success++;
    } catch (error) {
      failed++;
      errors.push(
        `Contribution ${contribution.civicrm_contribution_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return { success, failed, errors };
}

async function validateMigration(): Promise<void> {
  console.log('\n=== Migration Validation ===\n');

  // Count members
  const { count: memberCount } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true });

  // Count migrated members (those with CiviCRM ID)
  const { count: migratedMemberCount } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .not('civicrm_contact_id', 'is', null);

  // Count contributions
  const { count: contributionCount } = await supabase
    .from('rlc_contributions')
    .select('*', { count: 'exact', head: true });

  // Sum contributions
  const { data: contributionSum } = await supabase
    .from('rlc_contributions')
    .select('amount')
    .eq('payment_status', 'completed');

  const totalContributions =
    contributionSum?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  // Check migration log
  const { data: migrationStats } = await supabase
    .from('rlc_civicrm_migration_log')
    .select('entity_type, status')
    .order('entity_type');

  const logByType = migrationStats?.reduce(
    (acc, log) => {
      acc[log.entity_type] = acc[log.entity_type] || { completed: 0, failed: 0 };
      acc[log.entity_type][log.status === 'completed' ? 'completed' : 'failed']++;
      return acc;
    },
    {} as Record<string, { completed: number; failed: number }>
  );

  console.log('Supabase Counts:');
  console.log(`  Total Members: ${memberCount}`);
  console.log(`  Migrated Members: ${migratedMemberCount}`);
  console.log(`  Total Contributions: ${contributionCount}`);
  console.log(`  Contribution Total: $${totalContributions.toFixed(2)}`);

  console.log('\nMigration Log Summary:');
  for (const [type, stats] of Object.entries(logByType || {})) {
    console.log(`  ${type}: ${stats.completed} completed, ${stats.failed} failed`);
  }
}

function loadDataFile<T>(filename: string): T[] {
  const filePath = path.join(process.cwd(), 'scripts', 'civicrm', 'data', filename);

  if (!fs.existsSync(filePath)) {
    console.error(`Data file not found: ${filePath}`);
    console.log('Please export CiviCRM data and save as JSON in scripts/civicrm/data/');
    return [];
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const validateOnly = args.includes('--validate');
  const contactsOnly = args.includes('--contacts');

  console.log('===========================================');
  console.log('CiviCRM to Supabase Migration');
  console.log('===========================================');

  if (dryRun) {
    console.log('MODE: Dry Run (no data will be written)');
  }

  if (validateOnly) {
    await validateMigration();
    return;
  }

  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), 'scripts', 'civicrm', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('\nCreated data directory. Please add exported JSON files:');
    console.log('  - contacts.json');
    console.log('  - memberships.json');
    console.log('  - contributions.json');
    return;
  }

  // Migrate contacts
  const contacts = loadDataFile<CiviCRMContact>('contacts.json');
  if (contacts.length > 0) {
    const result = await migrateContacts(contacts, dryRun);
    console.log(`\nContacts: ${result.success} success, ${result.failed} failed`);
    if (result.errors.length > 0 && result.errors.length <= 10) {
      console.log('Errors:', result.errors);
    }
  }

  if (contactsOnly) {
    await validateMigration();
    return;
  }

  // Migrate memberships
  const memberships = loadDataFile<CiviCRMMembership>('memberships.json');
  if (memberships.length > 0) {
    const result = await migrateMemberships(memberships, dryRun);
    console.log(`\nMemberships: ${result.success} success, ${result.failed} failed`);
  }

  // Migrate contributions
  const contributions = loadDataFile<CiviCRMContribution>('contributions.json');
  if (contributions.length > 0) {
    const result = await migrateContributions(contributions, dryRun);
    console.log(`\nContributions: ${result.success} success, ${result.failed} failed`);
  }

  // Run validation
  await validateMigration();

  console.log('\n===========================================');
  console.log('Migration Complete');
  console.log('===========================================');
}

main().catch(console.error);
