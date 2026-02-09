import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTimestamps() {
  // Get counts by updated_at time
  const { data: members } = await supabase
    .from('rlc_members')
    .select('updated_at, membership_tier, created_at')
    .not('membership_tier', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  console.log('Most recently updated members with memberships:');
  members?.forEach(m => {
    console.log(`  Updated: ${m.updated_at}, Created: ${m.created_at}, Tier: ${m.membership_tier}`);
  });

  // Check contributions
  const { count: contribCount } = await supabase
    .from('rlc_contributions')
    .select('*', { count: 'exact', head: true });

  console.log(`\nContributions in database: ${contribCount}`);

  // Get a sample contribution if any exist
  if (contribCount && contribCount > 0) {
    const { data: sampleContrib } = await supabase
      .from('rlc_contributions')
      .select('*')
      .limit(5);

    console.log('\nSample contributions:');
    sampleContrib?.forEach(c => {
      console.log(`  Amount: $${c.amount}, Date: ${c.contribution_date}, Status: ${c.status}`);
    });
  }
}

checkTimestamps().catch(console.error);
