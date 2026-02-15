import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface CiviCRMGroupContact {
  civicrm_contact_id: number;
  civicrm_group_id: number;
  status: string;
}

interface CiviCRMGroup {
  civicrm_group_id: number;
  name: string;
  title: string;
}

async function assignChapters() {
  console.log('===========================================');
  console.log('Assigning Chapters from CiviCRM Groups');
  console.log('===========================================\n');

  // Load data
  const dataDir = path.join(process.cwd(), 'scripts', 'civicrm', 'data');
  const groupContacts: CiviCRMGroupContact[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'group_contacts.json'), 'utf-8')
  );
  const groups: CiviCRMGroup[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'groups.json'), 'utf-8')
  );

  console.log(`Loaded ${groupContacts.length} group memberships`);
  console.log(`Loaded ${groups.length} groups\n`);

  // Load all members with their civicrm_contact_id (paginated)
  console.log('Loading members from database...');
  let allMembers: any[] = [];
  let offset = 0;
  const LOAD_BATCH = 1000;

  while (true) {
    const { data: batch, error: memberError } = await supabase
      .from('rlc_contacts')
      .select('id, civicrm_contact_id')
      .not('civicrm_contact_id', 'is', null)
      .range(offset, offset + LOAD_BATCH - 1);

    if (memberError) {
      throw new Error(`Failed to load members: ${memberError.message}`);
    }

    if (!batch || batch.length === 0) break;
    allMembers = allMembers.concat(batch);
    offset += LOAD_BATCH;

    if (batch.length < LOAD_BATCH) break;
  }

  console.log(`Loaded ${allMembers.length} members with CiviCRM IDs\n`);

  // Create member lookup: civicrm_contact_id -> member_id
  const memberMap = new Map<number, string>();
  allMembers?.forEach(m => {
    if (m.civicrm_contact_id) {
      memberMap.set(m.civicrm_contact_id, m.id);
    }
  });

  // Load all chapters with their civicrm_group_id from metadata
  console.log('Loading chapters from database...');
  const { data: allChapters, error: chapterError } = await supabase
    .from('rlc_chapters')
    .select('id, metadata');

  if (chapterError) {
    throw new Error(`Failed to load chapters: ${chapterError.message}`);
  }

  // Create chapter lookup: civicrm_group_id -> chapter_id
  const chapterMap = new Map<number, string>();
  allChapters?.forEach(c => {
    const metadata = c.metadata as any;
    if (metadata && metadata.civicrm_group_id) {
      chapterMap.set(metadata.civicrm_group_id, c.id);
    }
  });

  console.log(`Loaded ${chapterMap.size} chapters with CiviCRM group IDs\n`);

  // Group contacts by member
  console.log('Grouping memberships by member...');
  const memberChapters = new Map<string, string[]>();

  for (const gc of groupContacts) {
    // Only process active memberships
    if (gc.status !== 'Added') continue;

    const memberId = memberMap.get(gc.civicrm_contact_id);
    const chapterId = chapterMap.get(gc.civicrm_group_id);

    if (memberId && chapterId) {
      if (!memberChapters.has(memberId)) {
        memberChapters.set(memberId, []);
      }
      memberChapters.get(memberId)!.push(chapterId);
    }
  }

  console.log(`Found ${memberChapters.size} members with chapter assignments\n`);

  // Assign primary_chapter_id (use first chapter for now)
  console.log('Assigning primary chapters...\n');

  let successCount = 0;
  let failCount = 0;
  let processedCount = 0;
  const totalToProcess = memberChapters.size;

  for (const [memberId, chapterIds] of memberChapters.entries()) {
    try {
      // Use UPDATE instead of upsert to only modify primary_chapter_id
      const { error } = await supabase
        .from('rlc_contacts')
        .update({ primary_chapter_id: chapterIds[0] })
        .eq('id', memberId);

      if (error) {
        failCount++;
        if (failCount <= 5) {
          console.error(`  Failed to update member ${memberId}:`, error.message);
        }
      } else {
        successCount++;
      }

      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`  Progress: ${processedCount}/${totalToProcess} (${successCount} success, ${failCount} failed)`);
      }
    } catch (error) {
      failCount++;
    }
  }

  console.log('\n===========================================');
  console.log('Chapter Assignment Complete');
  console.log('===========================================');
  console.log(`Successfully updated: ${successCount} members`);
  console.log(`Failed: ${failCount} members`);

  // Show final stats
  const { count: withChapter } = await supabase
    .from('rlc_contacts')
    .select('*', { count: 'exact', head: true })
    .not('primary_chapter_id', 'is', null);

  const { count: total } = await supabase
    .from('rlc_contacts')
    .select('*', { count: 'exact', head: true });

  console.log(`\nFinal: ${withChapter}/${total} members have chapters assigned`);
}

assignChapters().catch(error => {
  console.error('Chapter assignment failed:', error);
  process.exit(1);
});
