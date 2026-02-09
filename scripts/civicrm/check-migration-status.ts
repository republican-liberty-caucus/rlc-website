import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkDataQuality() {
  // Sample 10 random members with membership data
  const { data: samples } = await supabase
    .from('rlc_members')
    .select('first_name, last_name, membership_join_date, membership_tier, membership_status, created_at')
    .not('membership_tier', 'is', null)
    .limit(10);

  console.log('Sample member data:');
  samples?.forEach(m => {
    console.log(`  ${m.first_name} ${m.last_name}:`);
    console.log(`    Join date: ${m.membership_join_date || 'NULL'}`);
    console.log(`    Tier: ${m.membership_tier}, Status: ${m.membership_status}`);
    console.log(`    Created: ${m.created_at}`);
    console.log('');
  });

  // Check how many have join dates from CiviCRM (not today)
  const today = '2026-02-09';
  const { count: withOldJoinDates } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .not('membership_join_date', 'is', null)
    .lt('membership_join_date', today);

  const { count: withTodayJoinDates } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .gte('membership_join_date', today);

  const { count: nullJoinDates } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .is('membership_join_date', null);

  console.log(`Join date analysis:`);
  console.log(`  Historical join dates (before today): ${withOldJoinDates}`);
  console.log(`  Today's join dates: ${withTodayJoinDates}`);
  console.log(`  NULL join dates: ${nullJoinDates}`);
}

checkDataQuality().catch(console.error);
