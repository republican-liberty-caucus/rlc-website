import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface CiviCRMContribution {
  civicrm_contribution_id: number;
  civicrm_contact_id: number;
  total_amount: string;
  currency: string;
  financial_type: string;
  receive_date: string | null;
  contribution_status: string;
}

const CONTRIBUTION_TYPE_MAP: Record<string, string> = {
  'Member Dues': 'membership',
  'Membership Dues': 'membership',
  Donation: 'donation',
  'Campaign Contribution': 'donation',
  'Event Fee': 'event_registration',
  'Event Registration': 'event_registration',
};

interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

async function migrateContributionsOptimized(
  contributions: CiviCRMContribution[]
): Promise<MigrationResult> {
  console.log(`\nMigrating ${contributions.length} contributions (optimized batch mode)...`);

  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  // Step 1: Load ALL members into memory with a map (ONE query instead of 10,700)
  console.log('  Loading all members into memory...');

  // Load in batches to avoid default limit
  let allMembers: any[] = [];
  let offset = 0;
  const LOAD_BATCH_SIZE = 1000;

  while (true) {
    const { data: batch, error: loadError } = await supabase
      .from('rlc_contacts')
      .select('id, civicrm_contact_id')
      .not('civicrm_contact_id', 'is', null)
      .range(offset, offset + LOAD_BATCH_SIZE - 1);

    if (loadError) {
      throw new Error(`Failed to load members: ${loadError.message}`);
    }

    if (!batch || batch.length === 0) {
      break;
    }

    allMembers = allMembers.concat(batch);
    offset += LOAD_BATCH_SIZE;

    if (batch.length < LOAD_BATCH_SIZE) {
      break; // Last batch
    }
  }

  // Create a map: civicrm_contact_id -> member_id
  const memberMap = new Map<number, string>();
  allMembers.forEach(m => {
    if (m.civicrm_contact_id) {
      memberMap.set(m.civicrm_contact_id, m.id);
    }
  });

  console.log(`  Loaded ${memberMap.size} members into memory`);

  // Step 2: Build contribution records (no database calls)
  console.log('  Building contribution records...');
  const contributionRecords: any[] = [];
  const now = new Date().toISOString();

  for (const contribution of contributions) {
    const memberId = memberMap.get(contribution.civicrm_contact_id);

    if (!memberId) {
      result.errors.push(
        `Contribution ${contribution.civicrm_contribution_id}: Member not found for contact ${contribution.civicrm_contact_id}`
      );
      result.skipped++;
      continue;
    }

    contributionRecords.push({
      id: crypto.randomUUID(),
      member_id: memberId,
      contribution_type: CONTRIBUTION_TYPE_MAP[contribution.financial_type] || 'donation',
      amount: parseFloat(contribution.total_amount),
      currency: contribution.currency || 'USD',
      payment_status: contribution.contribution_status === 'Completed' ? 'completed' : 'pending',
      civicrm_contribution_id: contribution.civicrm_contribution_id,
      metadata: {},
      created_at: contribution.receive_date || now,
    });
  }

  console.log(`  Built ${contributionRecords.length} contribution records (${result.skipped} skipped)`);

  // Step 3: Batch insert (1000 at a time for safety)
  const BATCH_SIZE = 1000;
  const totalBatches = Math.ceil(contributionRecords.length / BATCH_SIZE);

  console.log(`  Inserting in ${totalBatches} batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < contributionRecords.length; i += BATCH_SIZE) {
    const batch = contributionRecords.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const { error: insertError } = await supabase
        .from('rlc_contributions')
        .upsert(batch as never, { onConflict: 'civicrm_contribution_id' });

      if (insertError) {
        console.error(`    Batch ${batchNumber}/${totalBatches}: FAILED`);
        console.error(`    Error details:`, JSON.stringify(insertError, null, 2));
        throw insertError;
      }

      result.success += batch.length;
      console.log(`    Batch ${batchNumber}/${totalBatches}: Inserted ${batch.length} contributions (total: ${result.success})`);
    } catch (error) {
      result.failed += batch.length;
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      result.errors.push(
        `Batch ${batchNumber} (records ${i}-${i + batch.length}): ${errorMsg}`
      );
    }
  }

  return result;
}

async function main() {
  const startTime = Date.now();

  console.log('===========================================');
  console.log('CiviCRM Contributions Migration (Optimized)');
  console.log('===========================================\n');

  // Load contributions data
  const dataDir = path.join(process.cwd(), 'scripts', 'civicrm', 'data');
  const contributionsPath = path.join(dataDir, 'contributions.json');

  if (!fs.existsSync(contributionsPath)) {
    console.error('Error: contributions.json not found');
    process.exit(1);
  }

  const contributions = JSON.parse(fs.readFileSync(contributionsPath, 'utf-8'));
  console.log(`Loaded ${contributions.length} contribution records\n`);

  // Run migration
  const result = await migrateContributionsOptimized(contributions);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n===========================================`);
  console.log(`Migration Results (completed in ${duration}s):`);
  console.log(`===========================================`);
  console.log(`Contributions: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`);

  if (result.errors.length > 0) {
    console.log(`\nFirst 10 errors:`);
    result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  console.log('\n===========================================');
  console.log('Migration Complete');
  console.log('===========================================\n');

  // Performance comparison
  console.log('Performance Improvement:');
  console.log(`  Old approach (sequential): ~30-40 minutes (21,400 queries)`);
  console.log(`  New approach (batched): ${duration}s (~${Math.ceil(contributions.length / 1000) + 1} queries)`);
  console.log(`  Speedup: ~${Math.round((2400 / parseFloat(duration)))}x faster\n`);
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
