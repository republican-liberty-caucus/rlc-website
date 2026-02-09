/**
 * Rollback HighLevel Import
 *
 * Reverts database to pre-import state using snapshot file.
 * Deletes contacts created by import and restores updated contacts.
 *
 * Usage:
 *   pnpm rollback:highlevel                    # Use latest snapshot
 *   pnpm rollback:highlevel --file=snapshot.json  # Use specific snapshot
 *   pnpm rollback:highlevel --dry-run          # Preview without changes
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
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

interface RollbackStats {
  deleted: number;
  restored: number;
  unchanged: number;
  errors: number;
}

function findLatestSnapshot(): string {
  const dataDir = join(process.cwd(), 'scripts', 'civicrm', 'data');
  const files = readdirSync(dataDir);
  const snapshotFiles = files
    .filter((f) => f.startsWith('highlevel-snapshot-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (snapshotFiles.length === 0) {
    throw new Error('No snapshot files found. Run `pnpm snapshot:highlevel` first.');
  }

  return join(dataDir, snapshotFiles[0]);
}

function loadSnapshot(filepath: string): Snapshot {
  const data = readFileSync(filepath, 'utf-8');
  return JSON.parse(data);
}

async function rollbackImport(
  snapshot: Snapshot,
  dryRun: boolean
): Promise<RollbackStats> {
  const stats: RollbackStats = {
    deleted: 0,
    restored: 0,
    unchanged: 0,
    errors: 0,
  };

  // Get current database state
  console.log('\nFetching current database state...');
  const { data: currentContacts, error: fetchError } = await supabase
    .from('rlc_members')
    .select('id, email, highlevel_contact_id, civicrm_contact_id');

  if (fetchError) {
    throw new Error(`Failed to fetch current contacts: ${fetchError.message}`);
  }

  // Build lookup maps
  const snapshotMap = new Map(snapshot.contacts.map((c) => [c.id, c]));
  const currentMap = new Map(currentContacts.map((c) => [c.id, c]));

  console.log('\nAnalyzing changes...\n');

  // Find contacts to delete (created during import)
  const toDelete: string[] = [];
  for (const [id, current] of currentMap) {
    const inSnapshot = snapshotMap.has(id);

    if (!inSnapshot && current.highlevel_contact_id) {
      // Contact was created during import (has HighLevel ID and not in snapshot)
      toDelete.push(id);
      console.log(`  🗑️  DELETE: ${current.email} (created during import)`);
    }
  }

  // Find contacts to restore (updated during import)
  const toRestore: ContactSnapshot[] = [];
  for (const [id, snapshotContact] of snapshotMap) {
    const current = currentMap.get(id);

    if (!current) {
      // Contact existed in snapshot but was deleted (unlikely, but handle it)
      console.warn(`  ⚠️  Contact ${snapshotContact.email} missing in current DB`);
      continue;
    }

    // Check if HighLevel ID was added during import
    const highlevelIdAdded =
      snapshotContact.highlevel_contact_id === null &&
      current.highlevel_contact_id !== null;

    // Check if data was modified
    const dataModified =
      snapshotContact.highlevel_contact_id !== current.highlevel_contact_id;

    if (highlevelIdAdded || dataModified) {
      toRestore.push(snapshotContact);
      console.log(`  ↩️  RESTORE: ${snapshotContact.email} (modified during import)`);
    }
  }

  console.log(`\n📊 Rollback Plan:`);
  console.log(`   Delete: ${toDelete.length} contacts`);
  console.log(`   Restore: ${toRestore.length} contacts`);
  console.log(`   Unchanged: ${currentMap.size - toDelete.length - toRestore.length}`);

  if (dryRun) {
    console.log('\n[DRY RUN] No changes made.');
    return stats;
  }

  // Execute rollback
  console.log('\n🔄 Executing rollback...\n');

  // Delete contacts created during import
  for (const id of toDelete) {
    const { error } = await supabase.from('rlc_members').delete().eq('id', id);

    if (error) {
      console.error(`  ❌ Failed to delete ${id}: ${error.message}`);
      stats.errors++;
    } else {
      stats.deleted++;
    }
  }

  // Restore contacts modified during import
  for (const contact of toRestore) {
    const { error } = await supabase
      .from('rlc_members')
      .update({
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.phone,
        address_line1: contact.address_line1,
        city: contact.city,
        state: contact.state,
        postal_code: contact.postal_code,
        membership_tier: contact.membership_tier,
        membership_status: contact.membership_status,
        membership_start_date: contact.membership_start_date,
        membership_expiry_date: contact.membership_expiry_date,
        membership_join_date: contact.membership_join_date,
        highlevel_contact_id: contact.highlevel_contact_id,
        // Don't update civicrm_contact_id — preserve it
      } as never)
      .eq('id', contact.id);

    if (error) {
      console.error(`  ❌ Failed to restore ${contact.email}: ${error.message}`);
      stats.errors++;
    } else {
      stats.restored++;
    }
  }

  // Delete sync log entries from import
  const { error: logError } = await supabase
    .from('rlc_highlevel_sync_log')
    .delete()
    .eq('action', 'import');

  if (logError) {
    console.warn(`  ⚠️  Failed to clean up sync log: ${logError.message}`);
  } else {
    console.log('  ✅ Cleaned up sync log entries');
  }

  stats.unchanged = currentMap.size - stats.deleted - stats.restored;

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find((a) => a.startsWith('--file='));
  const filepath = fileArg
    ? join(process.cwd(), 'scripts', 'civicrm', 'data', fileArg.split('=')[1])
    : findLatestSnapshot();

  console.log('===========================================');
  console.log('Rollback HighLevel Import');
  console.log('===========================================');

  if (dryRun) {
    console.log('MODE: Dry Run (no changes will be made)');
  }

  console.log(`\nUsing snapshot: ${filepath}`);

  const snapshot = loadSnapshot(filepath);
  console.log(`Snapshot date: ${new Date(snapshot.timestamp).toLocaleString()}`);
  console.log(`Snapshot contacts: ${snapshot.total_contacts}`);

  // Confirm before proceeding (unless dry-run)
  if (!dryRun) {
    console.log('\n⚠️  WARNING: This will delete contacts created during import!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const stats = await rollbackImport(snapshot, dryRun);

  console.log('\n===========================================');
  console.log('Rollback Complete');
  console.log('===========================================');
  console.log(`Deleted:   ${stats.deleted}`);
  console.log(`Restored:  ${stats.restored}`);
  console.log(`Unchanged: ${stats.unchanged}`);
  console.log(`Errors:    ${stats.errors}`);
  console.log('===========================================');

  if (stats.errors > 0) {
    console.log('\n⚠️  Some operations failed. Review errors above.');
    process.exit(1);
  } else if (!dryRun) {
    console.log('\n✅ Database restored to pre-import state.');
  }
}

main().catch((error) => {
  console.error('\n❌ Rollback failed:', error);
  process.exit(1);
});
