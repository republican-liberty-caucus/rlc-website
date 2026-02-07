/**
 * Sync Supabase Members to HighLevel
 *
 * Usage:
 *   pnpm sync:highlevel              # Sync all members
 *   pnpm sync:highlevel --dry-run    # Preview without syncing
 *   pnpm sync:highlevel --batch=100  # Sync in batches of 100
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HIGHLEVEL_API_KEY = process.env.HIGHLEVEL_API_KEY!;
const HIGHLEVEL_LOCATION_ID = process.env.HIGHLEVEL_LOCATION_ID!;
const HIGHLEVEL_BASE_URL = 'https://services.leadconnectorhq.com';
const HIGHLEVEL_API_VERSION = '2021-07-28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Member {
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
  highlevel_contact_id: string | null;
  primary_chapter?: { slug: string } | null;
}

interface HighLevelContact {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  tags?: string[];
  customField?: Record<string, string>;
  locationId: string;
}

async function createOrUpdateHighLevelContact(
  contact: HighLevelContact
): Promise<{ id: string } | null> {
  try {
    // First, try to find existing contact by email
    const searchResponse = await fetch(
      `${HIGHLEVEL_BASE_URL}/contacts/search?locationId=${HIGHLEVEL_LOCATION_ID}&email=${encodeURIComponent(contact.email)}`,
      {
        headers: {
          Authorization: `Bearer ${HIGHLEVEL_API_KEY}`,
          Version: HIGHLEVEL_API_VERSION,
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contacts && searchData.contacts.length > 0) {
        // Update existing contact
        const existingId = searchData.contacts[0].id;
        const updateResponse = await fetch(
          `${HIGHLEVEL_BASE_URL}/contacts/${existingId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${HIGHLEVEL_API_KEY}`,
              Version: HIGHLEVEL_API_VERSION,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(contact),
          }
        );

        if (updateResponse.ok) {
          return { id: existingId };
        }
      }
    }

    // Create new contact
    const createResponse = await fetch(`${HIGHLEVEL_BASE_URL}/contacts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HIGHLEVEL_API_KEY}`,
        Version: HIGHLEVEL_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contact),
    });

    if (createResponse.ok) {
      const data = await createResponse.json();
      return { id: data.contact?.id };
    }

    return null;
  } catch (error) {
    console.error('HighLevel API error:', error);
    return null;
  }
}

async function syncMember(
  member: Member,
  dryRun: boolean = false
): Promise<{ success: boolean; highlevelId?: string; error?: string }> {
  const tags = [
    'RLC Member',
    `RLC ${member.membership_tier.charAt(0).toUpperCase() + member.membership_tier.slice(1)}`,
  ];

  if (member.primary_chapter?.slug) {
    tags.push(`Chapter: ${member.primary_chapter.slug}`);
  }

  if (member.membership_status === 'active') {
    tags.push('Active Member');
  }

  const contactData: HighLevelContact = {
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    phone: member.phone || undefined,
    address1: member.address_line1 || undefined,
    city: member.city || undefined,
    state: member.state || undefined,
    postalCode: member.postal_code || undefined,
    country: 'US',
    tags,
    customField: {
      membership_tier: member.membership_tier,
      membership_status: member.membership_status,
      supabase_member_id: member.id,
    },
    locationId: HIGHLEVEL_LOCATION_ID,
  };

  if (dryRun) {
    console.log(`[DRY RUN] Would sync: ${member.email}`);
    return { success: true };
  }

  const result = await createOrUpdateHighLevelContact(contactData);

  if (result?.id) {
    // Update member with HighLevel ID
    await supabase
      .from('rlc_members')
      .update({ highlevel_contact_id: result.id })
      .eq('id', member.id);

    // Log the sync
    await supabase.from('rlc_highlevel_sync_log').insert({
      entity_type: 'member',
      entity_id: member.id,
      highlevel_id: result.id,
      action: 'sync',
      status: 'completed',
    });

    return { success: true, highlevelId: result.id };
  }

  // Log failure
  await supabase.from('rlc_highlevel_sync_log').insert({
    entity_type: 'member',
    entity_id: member.id,
    action: 'sync',
    status: 'failed',
    error_message: 'Failed to create/update contact',
  });

  return { success: false, error: 'Failed to create/update contact' };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 50;

  console.log('===========================================');
  console.log('Sync Members to HighLevel');
  console.log('===========================================');

  if (dryRun) {
    console.log('MODE: Dry Run (no data will be synced)');
  }

  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
    console.error('Missing HighLevel configuration. Set HIGHLEVEL_API_KEY and HIGHLEVEL_LOCATION_ID.');
    process.exit(1);
  }

  // Get members to sync
  const { data: members, error } = await supabase
    .from('rlc_members')
    .select(`
      id, email, first_name, last_name, phone,
      address_line1, city, state, postal_code,
      membership_tier, membership_status, highlevel_contact_id,
      primary_chapter:rlc_chapters(slug)
    `)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching members:', error);
    process.exit(1);
  }

  console.log(`\nFound ${members?.length || 0} members to sync`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < (members?.length || 0); i += batchSize) {
    const batch = members!.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}...`);

    for (const member of batch) {
      const result = await syncMember(member as unknown as Member, dryRun);
      if (result.success) {
        success++;
      } else {
        failed++;
        console.error(`  Failed: ${member.email} - ${result.error}`);
      }

      // Rate limiting - HighLevel has API limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`  Batch complete: ${batch.length} processed`);
  }

  console.log('\n===========================================');
  console.log('Sync Complete');
  console.log(`  Success: ${success}`);
  console.log(`  Failed: ${failed}`);
  console.log('===========================================');
}

main().catch(console.error);
