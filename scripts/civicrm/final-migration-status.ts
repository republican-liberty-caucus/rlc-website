import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getFinalStatus() {
  console.log('===========================================');
  console.log('Final CiviCRM Migration Status');
  console.log('===========================================\n');

  // Chapters
  const { count: chaptersCount } = await supabase
    .from('rlc_chapters')
    .select('*', { count: 'exact', head: true });

  console.log(`Chapters: ${chaptersCount || 0} total`);

  // Members
  const { count: totalMembers } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true });

  const { count: withEmail } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .not('email', 'is', null);

  const { count: withMembership } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .not('membership_tier', 'is', null);

  const { count: withHistoricalJoinDate } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .not('membership_join_date', 'is', null)
    .lt('membership_join_date', '2026-02-09');

  console.log(`\nMembers: ${totalMembers || 0} total`);
  console.log(`  With email: ${withEmail || 0}`);
  console.log(`  With membership data: ${withMembership || 0}`);
  console.log(`  With historical join dates: ${withHistoricalJoinDate || 0}`);

  // Contributions
  const { count: contributionsCount } = await supabase
    .from('rlc_contributions')
    .select('*', { count: 'exact', head: true });

  console.log(`\nContributions: ${contributionsCount || 0} total`);

  if (contributionsCount && contributionsCount > 0) {
    const { data: sampleContribs } = await supabase
      .from('rlc_contributions')
      .select('amount, contribution_date, status')
      .limit(5);

    console.log('  Sample contributions:');
    sampleContribs?.forEach(c => {
      console.log(`    $${c.amount} on ${c.contribution_date} (${c.status})`);
    });
  }

  // Member roles
  const { count: rolesCount } = await supabase
    .from('rlc_member_roles')
    .select('*', { count: 'exact', head: true });

  console.log(`\nMember roles: ${rolesCount || 0} total`);

  // Sample member data quality check
  const { data: sample } = await supabase
    .from('rlc_members')
    .select('first_name, last_name, membership_join_date, membership_tier, created_at, updated_at')
    .not('membership_tier', 'is', null)
    .limit(5);

  console.log('\nSample member data quality:');
  sample?.forEach(m => {
    console.log(`  ${m.first_name} ${m.last_name}:`);
    console.log(`    Join date: ${m.membership_join_date || 'NULL'}`);
    console.log(`    Tier: ${m.membership_tier}`);
    console.log(`    Created: ${m.created_at}`);
    console.log(`    Updated: ${m.updated_at}`);
    console.log(`    Created === Updated: ${m.created_at === m.updated_at ? 'YES' : 'NO'}`);
  });

  console.log('\n===========================================');
}

getFinalStatus().catch(console.error);
