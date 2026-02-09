/**
 * Validate HighLevel Import Results
 *
 * Runs post-import validation queries to verify data integrity.
 *
 * Usage:
 *   pnpm validate:highlevel
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ValidationResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runValidations(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // 1. Count members by source
  const { data: sourceCounts, error: sourceError } = await supabase.rpc('get_member_source_counts');

  if (!sourceError && sourceCounts) {
    const total = sourceCounts[0]?.total || 0;
    const fromCiviCRM = sourceCounts[0]?.from_civicrm || 0;
    const fromHighLevel = sourceCounts[0]?.from_highlevel || 0;
    const bothSources = sourceCounts[0]?.both_sources || 0;

    results.push({
      name: 'Member Source Distribution',
      passed: true,
      details: `Total: ${total}, CiviCRM: ${fromCiviCRM}, HighLevel: ${fromHighLevel}, Both: ${bothSources}`,
    });
  } else {
    // Fallback query if RPC doesn't exist
    const { count: total } = await supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true });

    const { count: fromCiviCRM } = await supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true })
      .not('civicrm_contact_id', 'is', null);

    const { count: fromHighLevel } = await supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true })
      .not('highlevel_contact_id', 'is', null);

    const { count: bothSources } = await supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true })
      .not('civicrm_contact_id', 'is', null)
      .not('highlevel_contact_id', 'is', null);

    results.push({
      name: 'Member Source Distribution',
      passed: true,
      details: `Total: ${total}, CiviCRM: ${fromCiviCRM}, HighLevel: ${fromHighLevel}, Both: ${bothSources}`,
    });
  }

  // 2. Check for duplicate HighLevel IDs
  const { data: duplicates, error: dupError } = await supabase
    .from('rlc_members')
    .select('highlevel_contact_id')
    .not('highlevel_contact_id', 'is', null);

  if (!dupError && duplicates) {
    const idCounts = duplicates.reduce(
      (acc, row) => {
        const id = row.highlevel_contact_id!;
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const duplicateIds = Object.entries(idCounts)
      .filter(([, count]) => count > 1)
      .map(([id, count]) => `${id} (${count})`);

    results.push({
      name: 'No Duplicate HighLevel IDs',
      passed: duplicateIds.length === 0,
      details: duplicateIds.length === 0 ? 'No duplicates found' : `Duplicates: ${duplicateIds.join(', ')}`,
    });
  }

  // 3. Check sync log success rate (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: syncLogs, error: logError } = await supabase
    .from('rlc_highlevel_sync_log')
    .select('action, status')
    .gte('created_at', oneHourAgo);

  if (!logError && syncLogs) {
    const totalLogs = syncLogs.length;
    const completed = syncLogs.filter((log) => log.status === 'completed').length;
    const failed = syncLogs.filter((log) => log.status === 'failed').length;
    const successRate = totalLogs > 0 ? ((completed / totalLogs) * 100).toFixed(1) : 'N/A';

    results.push({
      name: 'Sync Log Success Rate (last hour)',
      passed: totalLogs === 0 || (completed / totalLogs) >= 0.95,
      details: `${successRate}% (${completed}/${totalLogs} completed, ${failed} failed)`,
    });
  }

  // 4. Check for members with HighLevel ID but no email
  const { data: noEmail, error: emailError } = await supabase
    .from('rlc_members')
    .select('id, highlevel_contact_id')
    .not('highlevel_contact_id', 'is', null)
    .is('email', null);

  if (!emailError) {
    results.push({
      name: 'All HighLevel Members Have Email',
      passed: (noEmail?.length || 0) === 0,
      details: noEmail?.length === 0 ? 'All members have email' : `${noEmail?.length} members missing email`,
    });
  }

  // 5. Check for members with HighLevel ID but no membership tier
  const { data: noTier, error: tierError } = await supabase
    .from('rlc_members')
    .select('id, highlevel_contact_id, email')
    .not('highlevel_contact_id', 'is', null)
    .is('membership_tier', null);

  if (!tierError) {
    results.push({
      name: 'All HighLevel Members Have Tier',
      passed: (noTier?.length || 0) === 0,
      details: noTier?.length === 0 ? 'All members have tier' : `${noTier?.length} members missing tier`,
    });
  }

  return results;
}

async function main() {
  console.log('===========================================');
  console.log('HighLevel Import Validation');
  console.log('===========================================\n');

  const results = await runValidations();

  let allPassed = true;

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.name}`);
    console.log(`   ${result.details}\n`);

    if (!result.passed) {
      allPassed = false;
    }
  });

  console.log('===========================================');
  if (allPassed) {
    console.log('✅ All validations passed!');
  } else {
    console.log('❌ Some validations failed. Review above.');
  }
  console.log('===========================================');

  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('\n❌ Validation error:', error);
  process.exit(1);
});
