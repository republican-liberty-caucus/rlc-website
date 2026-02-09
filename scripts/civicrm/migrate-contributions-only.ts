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
  receive_date: string | null;
  contribution_status: string;
}

interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

async function migrateContributions(
  contributions: CiviCRMContribution[]
): Promise<MigrationResult> {
  console.log(`\nMigrating ${contributions.length} contributions...`);

  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  for (const contribution of contributions) {
    try {
      // Find the member by CiviCRM contact ID
      const { data: member } = await supabase
        .from('rlc_members')
        .select('id')
        .eq('civicrm_contact_id', contribution.civicrm_contact_id)
        .single();

      if (!member) {
        result.errors.push(
          `Contribution ${contribution.civicrm_contribution_id}: Member not found for contact ${contribution.civicrm_contact_id}`
        );
        result.skipped++;
        continue;
      }

      const now = new Date().toISOString();
      const { error } = await supabase.from('rlc_contributions').upsert(
        {
          id: crypto.randomUUID(),
          member_id: member.id,
          amount: parseFloat(contribution.total_amount),
          currency: contribution.currency || 'USD',
          contribution_date: contribution.receive_date || now,
          status: contribution.contribution_status === 'Completed' ? 'completed' : 'pending',
          civicrm_contribution_id: contribution.civicrm_contribution_id,
          created_at: contribution.receive_date || now,
          updated_at: contribution.receive_date || now,
        } as never,
        { onConflict: 'civicrm_contribution_id' }
      );

      if (error) {
        throw error;
      }

      result.success++;

      // Progress update every 100 contributions
      if (result.success % 100 === 0) {
        console.log(`  Processed ${result.success} contributions...`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(
        `Contribution ${contribution.civicrm_contribution_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return result;
}

async function main() {
  console.log('===========================================');
  console.log('CiviCRM Contributions Migration');
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
  const result = await migrateContributions(contributions);

  console.log(`\nContributions: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`);

  if (result.errors.length > 0) {
    console.log(`  First 10 errors:`);
    result.errors.slice(0, 10).forEach(err => console.log(`    - ${err}`));
    if (result.errors.length > 10) {
      console.log(`    ... and ${result.errors.length - 10} more`);
    }
  }

  console.log('\n===========================================');
  console.log('Migration Complete');
  console.log('===========================================\n');
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
