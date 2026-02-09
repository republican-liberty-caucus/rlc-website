import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkMattAdmin() {
  console.log('===========================================');
  console.log('Matt Admin Permissions Diagnostic');
  console.log('===========================================\n');

  // Find Matt
  const { data: matts } = await supabase
    .from('rlc_members')
    .select('id, email, first_name, last_name, clerk_user_id, primary_chapter_id')
    .or('email.ilike.%matt%nye%,email.eq.matt.nye@nyecorp.com');

  console.log(`Found ${matts?.length || 0} Matt Nye records:`);
  matts?.forEach(m => {
    console.log(`  - ${m.first_name} ${m.last_name} (${m.email})`);
    console.log(`    ID: ${m.id}`);
    console.log(`    Clerk ID: ${m.clerk_user_id || 'NULL'}`);
    console.log(`    Primary Chapter: ${m.primary_chapter_id || 'NULL'}`);
  });

  if (!matts || matts.length === 0) {
    console.log('\nNo Matt Nye found!');
    return;
  }

  // Check roles for each Matt
  for (const matt of matts) {
    console.log(`\n--- Roles for ${matt.email} ---`);
    const { data: roles } = await supabase
      .from('rlc_member_roles')
      .select('role, chapter_id, granted_at, expires_at')
      .eq('member_id', matt.id);

    if (!roles || roles.length === 0) {
      console.log('  NO ROLES ASSIGNED');
    } else {
      roles.forEach(r => {
        console.log(`  - ${r.role}`);
        console.log(`    Chapter: ${r.chapter_id || 'national'}`);
        console.log(`    Granted: ${r.granted_at}`);
        console.log(`    Expires: ${r.expires_at || 'never'}`);
      });
    }
  }

  // Check how members are distributed by chapter
  console.log('\n===========================================');
  console.log('Member Distribution by Chapter');
  console.log('===========================================\n');

  const { count: total } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true });

  const { count: withChapter } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .not('primary_chapter_id', 'is', null);

  const { count: withoutChapter } = await supabase
    .from('rlc_members')
    .select('*', { count: 'exact', head: true })
    .is('primary_chapter_id', null);

  console.log(`Total members: ${total}`);
  console.log(`  With chapter assigned: ${withChapter}`);
  console.log(`  Without chapter: ${withoutChapter}`);

  // Show what Matt would see based on chapter filter
  console.log('\n===========================================');
  console.log('Chapter-Based Visibility Simulation');
  console.log('===========================================\n');

  const { data: chapters } = await supabase
    .from('rlc_chapters')
    .select('id, name, slug');

  console.log(`Total chapters: ${chapters?.length || 0}\n`);

  // Count members per chapter
  for (const chapter of chapters || []) {
    const { count } = await supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true })
      .eq('primary_chapter_id', chapter.id);

    if (count && count > 0) {
      console.log(`  ${chapter.name}: ${count} members`);
    }
  }
}

checkMattAdmin().catch(console.error);
