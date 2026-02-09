/**
 * Import HighLevel Members to Supabase
 *
 * Imports ~200 members who signed up via HighLevel payment forms since July 2024.
 * Establishes Supabase as single source of truth by importing and linking these contacts.
 *
 * Usage:
 *   pnpm import:highlevel              # Import all members
 *   pnpm import:highlevel --dry-run    # Preview without importing
 *   pnpm import:highlevel --batch=50   # Custom batch size
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HIGHLEVEL_API_KEY = process.env.HIGHLEVEL_API_KEY!;
const HIGHLEVEL_LOCATION_ID = process.env.HIGHLEVEL_LOCATION_ID!;
const HIGHLEVEL_BASE_URL = 'https://services.leadconnectorhq.com';
const HIGHLEVEL_API_VERSION = '2021-07-28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Tier tag mapping (matches lib/highlevel/client.ts)
// NOTE: HighLevel tags are case-sensitive. These are the OUTBOUND tags (Supabase → HighLevel).
// For INBOUND parsing (HighLevel → Supabase), we need case-insensitive matching.
const TIER_TAGS: Record<string, string> = {
  student_military: 'Student/Military Member',
  individual: 'Individual Member',
  premium: 'Premium Member',
  sustaining: 'Sustaining Member',
  patron: 'Patron Member',
  benefactor: 'Benefactor Member',
  roundtable: 'Roundtable Member',
};

const STATUS_TAGS: Record<string, string> = {
  new_member: 'Membership: New',
  current: 'Membership: Current',
  grace: 'Membership: Grace',
  expired: 'Membership: Expired',
  pending: 'Membership: Pending',
  cancelled: 'Membership: Cancelled',
  deceased: 'Membership: Deceased',
  expiring: 'Membership: Expiring',
};

// Additional tag variations found in HighLevel (case-insensitive patterns)
const MEMBER_TAG_PATTERNS = [
  /^rlc member$/i,
  /^member$/i,
  /^membership type - /i,
  /^student\/military member$/i,
  /^individual member$/i,
  /^premium member$/i,
  /^sustaining member$/i,
  /^patron member$/i,
  /^benefactor member$/i,
  /^roundtable member$/i,
];

// Reverse lookups for parsing tags
const TIER_TAG_TO_KEY = Object.entries(TIER_TAGS).reduce(
  (acc, [key, val]) => ({ ...acc, [val]: key }),
  {} as Record<string, string>
);

const STATUS_TAG_TO_KEY = Object.entries(STATUS_TAGS).reduce(
  (acc, [key, val]) => ({ ...acc, [val]: key }),
  {} as Record<string, string>
);

interface HighLevelContact {
  id: string;
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
  dateAdded?: string; // When contact was created in HighLevel (original signup date)
  dateUpdated?: string;
}

interface ImportResult {
  success: boolean;
  action: 'created' | 'updated' | 'linked' | 'skipped';
  memberId?: string;
  error?: string;
}

interface ImportStats {
  total: number;
  members: number;
  nonMembers: number;
  created: number;
  updated: number;
  linked: number;
  skipped: number;
  errors: number;
}

/**
 * Fetch all contacts using cursor-based pagination
 */
async function fetchAllContacts(): Promise<HighLevelContact[]> {
  const allContacts: HighLevelContact[] = [];
  let startAfter: string | undefined;
  let pageCount = 0;

  console.log('\nFetching contacts from HighLevel...');

  while (true) {
    const params = new URLSearchParams({
      locationId: HIGHLEVEL_LOCATION_ID,
      limit: '100',
    });

    if (startAfter) {
      params.append('startAfter', startAfter);
    }

    const response = await fetch(
      `${HIGHLEVEL_BASE_URL}/contacts/?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${HIGHLEVEL_API_KEY}`,
          Version: HIGHLEVEL_API_VERSION,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HighLevel API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const contacts = data.contacts || [];
    allContacts.push(...contacts);

    pageCount++;
    console.log(`  Page ${pageCount}: fetched ${contacts.length} contacts (total: ${allContacts.length})`);

    // Check for next page cursor
    startAfter = data.meta?.nextStartAfter;
    if (!startAfter) {
      break;
    }

    // Rate limiting — 100 req/10s = 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\nFetched ${allContacts.length} total contacts from HighLevel`);
  return allContacts;
}

/**
 * Determine if a contact is a member
 * Qualifies as member if ANY of these are true:
 * - Has any tag matching MEMBER_TAG_PATTERNS
 * - Has membership_type_id or membership_status_id custom field
 */
function isMember(contact: HighLevelContact): boolean {
  const tags = contact.tags || [];
  const customFields = contact.customField || {};

  // Check for any member-related tag (case-insensitive)
  if (tags.some((tag) => MEMBER_TAG_PATTERNS.some((pattern) => pattern.test(tag)))) {
    return true;
  }

  // Check for membership custom fields
  if (customFields.membership_type_id || customFields.membership_status_id) {
    return true;
  }

  return false;
}

/**
 * Extract membership tier and status from tags or custom fields
 * Priority: custom fields > tags > defaults
 */
function extractMembershipData(contact: HighLevelContact): {
  tier: string;
  status: string;
  startDate?: string;
  expiryDate?: string;
  joinDate?: string;
} {
  const tags = contact.tags || [];
  const customFields = contact.customField || {};

  // Get tier — custom field takes priority over tags
  let tier = customFields.membership_type_id || 'individual';
  if (!customFields.membership_type_id) {
    // Parse from tags (case-insensitive)
    for (const tag of tags) {
      // Try exact match first
      const exactMatch = TIER_TAG_TO_KEY[tag];
      if (exactMatch) {
        tier = exactMatch;
        break;
      }

      // Try case-insensitive match
      const tagLower = tag.toLowerCase();
      if (tagLower.includes('student') || tagLower.includes('military')) {
        tier = 'student_military';
        break;
      } else if (tagLower.includes('individual')) {
        tier = 'individual';
        break;
      } else if (tagLower.includes('premium')) {
        tier = 'premium';
        break;
      } else if (tagLower.includes('sustaining')) {
        tier = 'sustaining';
        break;
      } else if (tagLower.includes('patron')) {
        tier = 'patron';
        break;
      } else if (tagLower.includes('benefactor')) {
        tier = 'benefactor';
        break;
      } else if (tagLower.includes('roundtable')) {
        tier = 'roundtable';
        break;
      }
    }
  }

  // Get status — custom field takes priority over tags
  let status = customFields.membership_status_id || 'current';
  if (!customFields.membership_status_id) {
    // Parse from tags (case-insensitive)
    for (const tag of tags) {
      // Try exact match first
      const exactMatch = STATUS_TAG_TO_KEY[tag];
      if (exactMatch) {
        status = exactMatch;
        break;
      }

      // Try case-insensitive match
      const tagLower = tag.toLowerCase();
      if (tagLower.includes('new')) {
        status = 'new_member';
        break;
      } else if (tagLower.includes('current')) {
        status = 'current';
        break;
      } else if (tagLower.includes('grace')) {
        status = 'grace';
        break;
      } else if (tagLower.includes('expired')) {
        status = 'expired';
        break;
      } else if (tagLower.includes('pending')) {
        status = 'pending';
        break;
      } else if (tagLower.includes('cancelled')) {
        status = 'cancelled';
        break;
      } else if (tagLower.includes('deceased')) {
        status = 'deceased';
        break;
      } else if (tagLower.includes('expiring')) {
        status = 'expiring';
        break;
      }
    }
  }

  // Get dates from custom fields, or use HighLevel's dateAdded as fallback for join date
  const startDate = customFields.membership_start_date;
  const expiryDate = customFields.membership_end_date;
  const joinDate = customFields.membership_join_date
    || customFields.membership_join_date_initial
    || contact.dateAdded; // Use original signup date from HighLevel

  return { tier, status, startDate, expiryDate, joinDate };
}

/**
 * Fetch opportunities (payments) for a contact to get actual join date
 */
async function fetchContactOpportunity(contactId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${HIGHLEVEL_BASE_URL}/opportunities/search?location_id=${HIGHLEVEL_LOCATION_ID}&contact_id=${contactId}`,
      {
        headers: {
          Authorization: `Bearer ${HIGHLEVEL_API_KEY}`,
          Version: HIGHLEVEL_API_VERSION,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const opportunities = data.opportunities || [];

    // Find the first "won" opportunity (successful payment)
    const wonOpp = opportunities.find((opp: any) => opp.status === 'won');
    if (wonOpp?.createdAt) {
      return wonOpp.createdAt; // Actual payment date
    }

    // Fallback to first opportunity if no "won" status
    if (opportunities[0]?.createdAt) {
      return opportunities[0].createdAt;
    }

    return null;
  } catch (error) {
    console.error(`  ⚠️  Failed to fetch opportunity for ${contactId}:`, error);
    return null;
  }
}

/**
 * Import a single member with deduplication logic
 *
 * Deduplication rules:
 * 1. Match by email (primary key)
 * 2. If existing contact found:
 *    - Has CiviCRM ID but no HighLevel ID? → Link HighLevel ID, update data
 *    - Has same HighLevel ID? → Update with latest data
 *    - Has different HighLevel ID? → Skip, log conflict
 * 3. If no match found → Create new contact
 */
async function importMember(
  hlContact: HighLevelContact,
  dryRun: boolean
): Promise<ImportResult> {
  let { tier, status, startDate, expiryDate, joinDate } = extractMembershipData(hlContact);

  // Fetch actual payment date from opportunities if no join date in custom fields
  if (!joinDate && !dryRun) {
    const paymentDate = await fetchContactOpportunity(hlContact.id);
    if (paymentDate) {
      joinDate = paymentDate;
    }
    // Rate limiting for opportunity API calls
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Check for existing contact by email
  const { data: existingContact, error: selectError } = await supabase
    .from('rlc_members')
    .select('id, highlevel_contact_id, civicrm_contact_id')
    .eq('email', hlContact.email)
    .maybeSingle();

  if (selectError) {
    return {
      success: false,
      action: 'skipped',
      error: `Database query error: ${selectError.message}`,
    };
  }

  // Prepare contact data (without ID - will be added for inserts only)
  const now = new Date().toISOString();
  const joinDateISO = joinDate ? new Date(joinDate).toISOString() : null;

  const contactData = {
    email: hlContact.email,
    first_name: hlContact.firstName,
    last_name: hlContact.lastName,
    phone: hlContact.phone || null,
    address_line1: hlContact.address1 || null,
    city: hlContact.city || null,
    state: hlContact.state || null,
    postal_code: hlContact.postalCode || null,
    country: hlContact.country || 'US',
    membership_tier: tier,
    membership_status: status,
    membership_start_date: startDate ? new Date(startDate).toISOString() : null,
    membership_expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
    membership_join_date: joinDateISO,
    highlevel_contact_id: hlContact.id,
    updated_at: now, // Required by schema (not auto-managed when using Supabase client)
  };

  if (existingContact) {
    // Existing contact found — check HighLevel ID
    if (existingContact.highlevel_contact_id && existingContact.highlevel_contact_id !== hlContact.id) {
      // Conflict: different HighLevel ID
      console.warn(
        `  ⚠️  Conflict: ${hlContact.email} has different HighLevel ID (existing: ${existingContact.highlevel_contact_id}, new: ${hlContact.id})`
      );
      return {
        success: false,
        action: 'skipped',
        error: 'HighLevel ID conflict',
      };
    }

    if (dryRun) {
      const action = existingContact.highlevel_contact_id ? 'updated' : 'linked';
      console.log(
        `  [DRY RUN] Would ${action}: ${hlContact.email} (${tier}/${status}) → member ${existingContact.id}`
      );
      return { success: true, action, memberId: existingContact.id };
    }

    // Update existing contact
    const { error: updateError } = await supabase
      .from('rlc_members')
      .update(contactData as never)
      .eq('id', existingContact.id);

    if (updateError) {
      return {
        success: false,
        action: 'skipped',
        error: `Update failed: ${updateError.message}`,
      };
    }

    // Log the sync
    await supabase.from('rlc_highlevel_sync_log').insert({
      entity_type: 'member',
      entity_id: existingContact.id,
      highlevel_id: hlContact.id,
      action: 'import',
      status: 'completed',
      request_payload: hlContact,
    } as never);

    const action = existingContact.highlevel_contact_id ? 'updated' : 'linked';
    return { success: true, action, memberId: existingContact.id };
  } else {
    // No existing contact — create new
    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${hlContact.email} (${tier}/${status})`);
      return { success: true, action: 'created' };
    }

    // Use join date (or HighLevel dateAdded) as created_at to reflect actual signup date
    const createdAt = joinDateISO || hlContact.dateAdded || now;

    const { data: newContact, error: insertError } = await supabase
      .from('rlc_members')
      .insert({ ...contactData, id: randomUUID(), created_at: createdAt } as never)
      .select('id')
      .single();

    if (insertError) {
      return {
        success: false,
        action: 'skipped',
        error: `Insert failed: ${insertError.message}`,
      };
    }

    // Log the sync
    await supabase.from('rlc_highlevel_sync_log').insert({
      entity_type: 'member',
      entity_id: newContact.id,
      highlevel_id: hlContact.id,
      action: 'import',
      status: 'completed',
      request_payload: hlContact,
    } as never);

    return { success: true, action: 'created', memberId: newContact.id };
  }
}

/**
 * Main import process
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 50;

  console.log('===========================================');
  console.log('Import HighLevel Members to Supabase');
  console.log('===========================================');

  if (dryRun) {
    console.log('MODE: Dry Run (no data will be imported)');
  }

  if (!HIGHLEVEL_API_KEY || !HIGHLEVEL_LOCATION_ID) {
    console.error('Missing HighLevel configuration. Set HIGHLEVEL_API_KEY and HIGHLEVEL_LOCATION_ID.');
    process.exit(1);
  }

  // Fetch all contacts
  const allContacts = await fetchAllContacts();

  // Filter to members only
  const members = allContacts.filter(isMember);
  const nonMembers = allContacts.length - members.length;

  console.log(`\nIdentified ${members.length} members (${nonMembers} non-members skipped)`);

  if (members.length === 0) {
    console.log('\nNo members to import.');
    return;
  }

  const stats: ImportStats = {
    total: members.length,
    members: members.length,
    nonMembers,
    created: 0,
    updated: 0,
    linked: 0,
    skipped: 0,
    errors: 0,
  };

  const errors: Array<{ email: string; error: string }> = [];

  // Process in batches
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`\nProcessing batch ${batchNum} (${batch.length} members)...`);

    for (const contact of batch) {
      const result = await importMember(contact, dryRun);

      if (result.success) {
        stats[result.action]++;
      } else {
        stats.errors++;
        errors.push({ email: contact.email, error: result.error || 'Unknown error' });
        console.error(`  ❌ Failed: ${contact.email} - ${result.error}`);
      }

      // Rate limiting — 100 req/10s = 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`  ✅ Batch ${batchNum} complete`);
  }

  console.log('\n===========================================');
  console.log('Import Complete');
  console.log('===========================================');
  console.log(`Total Contacts:    ${stats.total}`);
  console.log(`Members:           ${stats.members}`);
  console.log(`Non-Members:       ${stats.nonMembers}`);
  console.log(`Created:           ${stats.created}`);
  console.log(`Updated:           ${stats.updated}`);
  console.log(`Linked:            ${stats.linked}`);
  console.log(`Skipped:           ${stats.skipped}`);
  console.log(`Errors:            ${stats.errors}`);
  console.log('===========================================');

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.slice(0, 10).forEach(({ email, error }) => {
      console.log(`  - ${email}: ${error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more`);
    }
  }

  if (!dryRun) {
    console.log('\n✅ Import logged to rlc_highlevel_sync_log table');
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
