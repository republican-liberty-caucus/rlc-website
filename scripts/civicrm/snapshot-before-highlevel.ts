/**
 * Create Snapshot Before HighLevel Import
 *
 * Records current database state before import for rollback capability.
 * Creates a snapshot file with all contacts that will be affected.
 *
 * Usage:
 *   pnpm snapshot:highlevel
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ContactSnapshot {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  membership_tier: string;
  membership_status: string;
  membership_start_date: string | null;
  membership_expiry_date: string | null;
  membership_join_date: string | null;
  highlevel_contact_id: string | null;
  civicrm_contact_id: number | null;
  created_at: string;
  updated_at: string;
}

interface Snapshot {
  timestamp: string;
  total_contacts: number;
  contacts_with_highlevel_id: number;
  contacts_without_highlevel_id: number;
  contacts: ContactSnapshot[];
}

async function createSnapshot(): Promise<Snapshot> {
  console.log('Fetching all contacts from database...');

  // Paginate to fetch all rows (Supabase default limit is 1000)
  const PAGE_SIZE = 1000;
  const contacts: ContactSnapshot[] = [];
  let offset = 0;

  while (true) {
    const { data: page, error: pageError } = await supabase
      .from('rlc_contacts')
      .select(
        `
        id, email, first_name, last_name, phone,
        address_line1, city, state, postal_code,
        membership_tier, membership_status,
        membership_start_date, membership_expiry_date, membership_join_date,
        highlevel_contact_id, civicrm_contact_id,
        created_at, updated_at
      `
      )
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (pageError) {
      throw new Error(`Failed to fetch contacts at offset ${offset}: ${pageError.message}`);
    }

    contacts.push(...(page as ContactSnapshot[]));
    console.log(`  Fetched ${contacts.length} contacts...`);

    if (!page || page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const error = null; // Keep downstream code happy

  if (error) {
    throw new Error(`Failed to fetch contacts: ${error.message}`);
  }

  const withHighLevel = contacts.filter((c) => c.highlevel_contact_id !== null).length;
  const withoutHighLevel = contacts.filter((c) => c.highlevel_contact_id === null).length;

  const snapshot: Snapshot = {
    timestamp: new Date().toISOString(),
    total_contacts: contacts.length,
    contacts_with_highlevel_id: withHighLevel,
    contacts_without_highlevel_id: withoutHighLevel,
    contacts: contacts as ContactSnapshot[],
  };

  return snapshot;
}

async function main() {
  console.log('===========================================');
  console.log('Create Pre-Import Snapshot');
  console.log('===========================================\n');

  const snapshot = await createSnapshot();

  // Save snapshot to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `highlevel-snapshot-${timestamp}.json`;
  const filepath = join(process.cwd(), 'scripts', 'civicrm', 'data', filename);

  writeFileSync(filepath, JSON.stringify(snapshot, null, 2));

  console.log('Snapshot created successfully!\n');
  console.log(`File: ${filepath}`);
  console.log(`Total contacts: ${snapshot.total_contacts}`);
  console.log(`With HighLevel ID: ${snapshot.contacts_with_highlevel_id}`);
  console.log(`Without HighLevel ID: ${snapshot.contacts_without_highlevel_id}`);
  console.log('\n===========================================');
  console.log('✅ You can now run the import safely.');
  console.log('   To rollback: pnpm rollback:highlevel');
  console.log('===========================================');
}

main().catch((error) => {
  console.error('\n❌ Snapshot creation failed:', error);
  process.exit(1);
});
