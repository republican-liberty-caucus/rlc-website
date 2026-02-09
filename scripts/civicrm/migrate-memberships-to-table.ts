import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface CiviCRMMembership {
  civicrm_membership_id: number;
  civicrm_contact_id: number;
  membership_type_name: string;
  membership_status: string;
  join_date: string | null;
  start_date: string | null;
  end_date: string | null;
  source: string | null;
  is_test: number;
  is_pay_later: number;
  contribution_recur_id: number | null;
}

const membershipTierMap: { [key: string]: string } = {
  'Individual': 'individual',
  'Student/Military': 'student_military',
  'Premium': 'premium',
  'Sustaining': 'sustaining',
  'Patron': 'patron',
  'Benefactor': 'benefactor',
  'Roundtable': 'roundtable',
};

const membershipStatusMap: { [key: string]: string } = {
  'New': 'new_member',
  'Current': 'current',
  'Grace': 'grace',
  'Expired': 'expired',
  'Pending': 'pending',
  'Cancelled': 'cancelled',
  'Deceased': 'deceased',
};

async function migrateMemberships() {
  console.log('===========================================');
  console.log('Importing CiviCRM Memberships to rlc_memberships');
  console.log('===========================================\\n');

  // Load membership data
  const dataDir = path.join(process.cwd(), 'scripts', 'civicrm', 'data');
  const memberships: CiviCRMMembership[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'memberships.json'), 'utf-8')
  );

  console.log(`Loaded ${memberships.length} memberships from CiviCRM\\n`);

  // Load all members with their civicrm_contact_id (paginated)
  console.log('Loading members from database...');
  let allMembers: any[] = [];
  let offset = 0;
  const LOAD_BATCH = 1000;

  while (true) {
    const { data: batch, error: memberError } = await supabase
      .from('rlc_members')
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

  console.log(`Loaded ${allMembers.length} members with CiviCRM IDs\\n`);

  // Create contact lookup map
  const contactMap = new Map<number, string>();
  allMembers.forEach(m => {
    if (m.civicrm_contact_id) {
      contactMap.set(m.civicrm_contact_id, m.id);
    }
  });

  // Transform memberships to new schema
  console.log('Transforming memberships...');
  const membershipRecords: any[] = [];
  let skipped = 0;

  for (const membership of memberships) {
    // Skip test records
    if (membership.is_test === 1) {
      skipped++;
      continue;
    }

    // Find contact
    const contactId = contactMap.get(membership.civicrm_contact_id);
    if (!contactId) {
      skipped++;
      continue;
    }

    // Map tier and status
    const tier = membershipTierMap[membership.membership_type_name] || 'individual';
    const status = membershipStatusMap[membership.membership_status] || 'expired';

    membershipRecords.push({
      id: crypto.randomUUID(),
      contact_id: contactId,
      membership_tier: tier,
      membership_status: status,
      start_date: membership.start_date || null,
      expiry_date: membership.end_date || null,
      join_date: membership.join_date || null,
      amount: null, // Will be populated from contributions if needed
      currency: 'USD',
      civicrm_membership_id: membership.civicrm_membership_id,
      is_auto_renew: membership.contribution_recur_id ? true : false,
      stripe_subscription_id: null,
      metadata: JSON.stringify({
        membership_type_name: membership.membership_type_name,
        membership_status: membership.membership_status,
        source: membership.source,
      }),
      created_at: membership.join_date || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`Transformed ${membershipRecords.length} memberships`);
  console.log(`Skipped ${skipped} (${skipped - (memberships.length - membershipRecords.length - skipped)} test records, ${contactMap.size - membershipRecords.length} no contact match)\\n`);

  // Batch insert (1000 at a time)
  console.log('Inserting memberships into database...\\n');
  const BATCH_SIZE = 1000;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < membershipRecords.length; i += BATCH_SIZE) {
    const batch = membershipRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('rlc_memberships')
      .upsert(batch, { onConflict: 'civicrm_membership_id' });

    if (error) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      failCount += batch.length;
    } else {
      successCount += batch.length;
      console.log(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successCount}/${membershipRecords.length}`);
    }
  }

  console.log('\\n===========================================');
  console.log('Membership Import Complete');
  console.log('===========================================');
  console.log(`Successfully imported: ${successCount} memberships`);
  console.log(`Failed: ${failCount} memberships`);

  // Show stats
  const { count: totalMemberships } = await supabase
    .from('rlc_memberships')
    .select('*', { count: 'exact', head: true });

  console.log(`\\nTotal memberships in database: ${totalMemberships}`);

  // Show status breakdown
  const { data: statusStats } = await supabase
    .from('rlc_memberships')
    .select('membership_status')
    .then(res => {
      const stats: { [key: string]: number } = {};
      res.data?.forEach(m => {
        stats[m.membership_status] = (stats[m.membership_status] || 0) + 1;
      });
      return { data: stats };
    });

  console.log('\\nStatus breakdown:');
  Object.entries(statusStats || {}).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

migrateMemberships().catch(error => {
  console.error('Membership import failed:', error);
  process.exit(1);
});
