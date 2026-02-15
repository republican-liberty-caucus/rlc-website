/**
 * CiviCRM to Supabase Migration Script
 *
 * Usage:
 *   pnpm migrate:civicrm              # Run full migration
 *   pnpm migrate:civicrm --dry-run    # Validate without writing
 *   pnpm migrate:civicrm --contacts   # Migrate only contacts
 *   pnpm migrate:civicrm --chapters   # Migrate only chapters
 *   pnpm migrate:civicrm --households # Migrate only households
 *   pnpm migrate:civicrm --validate   # Run validation only
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ===========================================
// Type definitions
// ===========================================

interface CiviCRMContact {
  civicrm_id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  primary_email: string;
  primary_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  do_not_email?: boolean;
  do_not_phone?: boolean;
  do_not_sms?: boolean;
  email_opt_out?: boolean;
  created_date: string;
}

interface CiviCRMMembership {
  civicrm_membership_id: number;
  civicrm_contact_id: number;
  membership_type_name: string;
  membership_status: string;
  join_date?: string;
  start_date?: string;
  end_date?: string;
  source?: string;
  contribution_recur_id?: number | null;
}

interface CiviCRMContribution {
  civicrm_contribution_id: number;
  civicrm_contact_id: number;
  total_amount: number;
  currency: string;
  receive_date: string;
  financial_type: string;
  contribution_status: string;
  payment_method?: string;
  transaction_id?: string;
  source?: string;
  contribution_recur_id?: number | null;
  campaign_id?: number | null;
}

interface CiviCRMGroup {
  civicrm_group_id: number;
  name: string;
  title: string;
  description?: string;
  is_active: boolean;
  member_count: number;
}

interface CiviCRMGroupContact {
  civicrm_group_id: number;
  civicrm_contact_id: number;
  status: string;
  group_title: string;
}

interface CiviCRMRelationship {
  id: number;
  contact_id_a: number;
  contact_id_b: number;
  name_a_b: string;
  name_b_a: string;
}

interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// ===========================================
// Mapping configurations
// ===========================================

// 7 tiers from PRD Section 2
const TIER_MAP: Record<string, string> = {
  General: 'individual',
  Individual: 'individual',
  Premium: 'premium',
  Sustaining: 'sustaining',
  Patron: 'patron',
  Benefactor: 'benefactor',
  Roundtable: 'roundtable',
  Student: 'student_military',
  'Student/Military': 'student_military',
  'Board Member': 'individual', // + national_board role assigned separately
};

// 8 statuses from PRD Section 2 (maps to Prisma enum values)
// Prisma uses "new_member" but Supabase column stores the raw enum value
const STATUS_MAP: Record<string, string> = {
  New: 'new_member',
  Current: 'current',
  Grace: 'grace',
  Expired: 'expired',
  Pending: 'pending',
  Cancelled: 'cancelled',
  Deceased: 'deceased',
  // "expiring" is computed by cron, not imported from CiviCRM
};

const CONTRIBUTION_TYPE_MAP: Record<string, string> = {
  'Member Dues': 'membership',
  'Membership Dues': 'membership',
  Donation: 'donation',
  'Event Fee': 'event_registration',
  'Event Registration': 'event_registration',
};

const CONTRIBUTION_STATUS_MAP: Record<string, string> = {
  Completed: 'completed',
  Pending: 'pending',
  Failed: 'failed',
  Refunded: 'refunded',
  Cancelled: 'cancelled',
  'Partially paid': 'pending',
};

// US state name → abbreviation for chapter parsing
const STATE_ABBREVS: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

// ===========================================
// Chapter migration
// ===========================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseChapterLevel(title: string): { level: string; stateCode: string | null; regionName: string | null } {
  const lower = title.toLowerCase();

  // Check for national
  if (lower === 'republican liberty caucus' || lower === 'rlc national') {
    return { level: 'national', stateCode: null, regionName: null };
  }

  // Check for state match
  for (const [stateName, abbrev] of Object.entries(STATE_ABBREVS)) {
    if (lower.includes(stateName)) {
      // Check if it's a county/city chapter within a state
      if (lower.includes('county') || lower.includes('chapter of') || lower.includes('caucus of')) {
        // Could be a county-level chapter, but also could be state-level "Republican Liberty Caucus of Florida"
        // If it just matches "of <state>" it's state level
        const statePattern = new RegExp(`(republican liberty caucus of |rlc )${stateName}$`, 'i');
        if (statePattern.test(lower.trim())) {
          return { level: 'state', stateCode: abbrev, regionName: null };
        }
        return { level: 'county', stateCode: abbrev, regionName: null };
      }
      return { level: 'state', stateCode: abbrev, regionName: null };
    }
  }

  // Check for region keywords
  if (lower.includes('region') || lower.includes('southeast') || lower.includes('northeast') ||
      lower.includes('midwest') || lower.includes('southwest') || lower.includes('northwest') ||
      lower.includes('pacific') || lower.includes('mountain')) {
    return { level: 'multi_state_region', stateCode: null, regionName: title };
  }

  // Default to state level for unrecognized chapters
  return { level: 'state', stateCode: null, regionName: null };
}

async function migrateChapters(
  groups: CiviCRMGroup[],
  dryRun: boolean = false
): Promise<MigrationResult> {
  console.log(`\nMigrating ${groups.length} chapters from CiviCRM groups...`);

  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  // First, create the national chapter as root
  const nationalData = {
    name: 'Republican Liberty Caucus',
    slug: 'national',
    chapter_level: 'national',
    parent_chapter_id: null,
    state_code: null,
    region_name: null,
    status: 'active',
    metadata: {},
    leadership: {},
  };

  let nationalId: string | null = null;

  if (!dryRun) {
    const { data, error } = await supabase
      .from('rlc_chapters')
      .upsert(nationalData as never, { onConflict: 'slug' })
      .select('id')
      .single();

    if (error) {
      result.errors.push(`National chapter: ${error.message}`);
      result.failed++;
    } else {
      nationalId = data.id;
      result.success++;
    }
  } else {
    console.log(`  [DRY RUN] Would create national chapter`);
    result.success++;
  }

  // Then create state/county chapters
  for (const group of groups) {
    try {
      const parsed = parseChapterLevel(group.title || group.name);

      // Skip if it's the national-level group (already created)
      if (parsed.level === 'national') {
        result.skipped++;
        continue;
      }

      const slug = slugify(group.title || group.name);
      const chapterData = {
        name: group.title || group.name,
        slug,
        chapter_level: parsed.level,
        parent_chapter_id: nationalId, // State chapters → national. County chapters need manual hierarchy adjustment.
        state_code: parsed.stateCode,
        region_name: parsed.regionName,
        status: 'active',
        metadata: {
          civicrm_group_id: group.civicrm_group_id,
          civicrm_member_count: group.member_count,
        },
        leadership: {},
      };

      if (dryRun) {
        console.log(`  [DRY RUN] ${parsed.level}: ${chapterData.name} (${parsed.stateCode || 'no state'}) — ${group.member_count} members`);
      } else {
        const { error } = await supabase
          .from('rlc_chapters')
          .upsert(chapterData as never, { onConflict: 'slug' });

        if (error) {
          throw error;
        }

        await supabase.from('rlc_civicrm_migration_log').insert({
          entity_type: 'chapter',
          civicrm_id: group.civicrm_group_id,
          status: 'completed',
          migrated_at: new Date().toISOString(),
        });
      }

      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push(
        `Chapter "${group.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return result;
}

// ===========================================
// Contact migration
// ===========================================

async function migrateContacts(
  contacts: CiviCRMContact[],
  groupContacts: CiviCRMGroupContact[],
  dryRun: boolean = false
): Promise<MigrationResult> {
  console.log(`\nMigrating ${contacts.length} contacts...`);

  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  // Build a map of contact → chapter for assignment
  const contactChapterMap = new Map<number, string>();
  if (groupContacts.length > 0) {
    // Get chapters with their CiviCRM group IDs from metadata
    const { data: chapters } = await supabase
      .from('rlc_chapters')
      .select('id, metadata');

    if (chapters) {
      const groupIdToChapterId = new Map<number, string>();
      for (const ch of chapters) {
        const meta = ch.metadata as Record<string, unknown>;
        if (meta?.civicrm_group_id) {
          groupIdToChapterId.set(meta.civicrm_group_id as number, ch.id);
        }
      }

      for (const gc of groupContacts) {
        const chapterId = groupIdToChapterId.get(gc.civicrm_group_id);
        if (chapterId) {
          contactChapterMap.set(gc.civicrm_contact_id, chapterId);
        }
      }
    }
  }

  for (const contact of contacts) {
    try {
      const email = contact.primary_email?.toLowerCase().trim();

      if (!email) {
        result.errors.push(`Contact ${contact.civicrm_id}: Missing email`);
        result.skipped++;
        continue;
      }

      const memberData = {
        email,
        first_name: contact.first_name || 'Unknown',
        last_name: contact.last_name || 'User',
        phone: contact.primary_phone || null,
        address_line1: contact.address_line1 || null,
        address_line2: contact.address_line2 || null,
        city: contact.city || null,
        state: contact.state || null,
        postal_code: contact.postal_code || null,
        country: contact.country || 'US',
        email_opt_in: !contact.email_opt_out && !contact.do_not_email,
        sms_opt_in: !contact.do_not_sms,
        do_not_phone: contact.do_not_phone || false,
        civicrm_contact_id: contact.civicrm_id,
        membership_tier: 'individual',
        membership_status: 'pending',
        primary_chapter_id: contactChapterMap.get(contact.civicrm_id) || null,
      };

      if (dryRun) {
        if (result.success % 500 === 0 && result.success > 0) {
          console.log(`  [DRY RUN] Processed ${result.success} contacts...`);
        }
      } else {
        const { error } = await supabase.from('rlc_contacts').upsert(memberData as never, {
          onConflict: 'civicrm_contact_id',
        });

        if (error) {
          throw error;
        }

        await supabase.from('rlc_civicrm_migration_log').insert({
          entity_type: 'contact',
          civicrm_id: contact.civicrm_id,
          status: 'completed',
          migrated_at: new Date().toISOString(),
        });
      }

      result.success++;

      if (result.success % 100 === 0) {
        console.log(`  Processed ${result.success} contacts...`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(
        `Contact ${contact.civicrm_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return result;
}

// ===========================================
// Membership migration
// ===========================================

async function migrateMemberships(
  memberships: CiviCRMMembership[],
  dryRun: boolean = false
): Promise<MigrationResult> {
  console.log(`\nMigrating ${memberships.length} memberships...`);

  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  // Track board members for role assignment
  const boardMemberContactIds: number[] = [];

  for (const membership of memberships) {
    try {
      // Find the member by CiviCRM contact ID
      const { data: member } = await supabase
        .from('rlc_contacts')
        .select('id')
        .eq('civicrm_contact_id', membership.civicrm_contact_id)
        .single();

      if (!member) {
        result.errors.push(
          `Membership ${membership.civicrm_membership_id}: Member not found for contact ${membership.civicrm_contact_id}`
        );
        result.skipped++;
        continue;
      }

      const tier = TIER_MAP[membership.membership_type_name] || 'individual';
      const status = STATUS_MAP[membership.membership_status] || 'pending';

      // Track board members for role assignment
      if (membership.membership_type_name === 'Board Member') {
        boardMemberContactIds.push(membership.civicrm_contact_id);
      }

      if (!dryRun) {
        const { error } = await supabase
          .from('rlc_contacts')
          .update({
            membership_tier: tier,
            membership_status: status,
            membership_start_date: membership.start_date || membership.join_date,
            membership_expiry_date: membership.end_date,
            membership_join_date: membership.join_date,
          })
          .eq('id', member.id);

        if (error) {
          throw error;
        }
      }

      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push(
        `Membership ${membership.civicrm_membership_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Assign national_board roles to Board Members
  if (boardMemberContactIds.length > 0 && !dryRun) {
    console.log(`\n  Assigning national_board role to ${boardMemberContactIds.length} board members...`);
    for (const contactId of boardMemberContactIds) {
      try {
        const { data: member } = await supabase
          .from('rlc_contacts')
          .select('id')
          .eq('civicrm_contact_id', contactId)
          .single();

        if (member) {
          await supabase.from('rlc_contact_roles').upsert(
            {
              member_id: member.id,
              role: 'national_board',
              chapter_id: null,
            } as never,
            { onConflict: 'member_id,role,chapter_id' }
          );
        }
      } catch (error) {
        result.errors.push(
          `Board role for contact ${contactId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } else if (boardMemberContactIds.length > 0) {
    console.log(`  [DRY RUN] Would assign national_board role to ${boardMemberContactIds.length} members`);
  }

  return result;
}

// ===========================================
// Contribution migration
// ===========================================

async function migrateContributions(
  contributions: CiviCRMContribution[],
  dryRun: boolean = false
): Promise<MigrationResult> {
  console.log(`\nMigrating ${contributions.length} contributions...`);

  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  for (const contribution of contributions) {
    try {
      // Find the member by CiviCRM contact ID
      const { data: member } = await supabase
        .from('rlc_contacts')
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

      const contributionType =
        CONTRIBUTION_TYPE_MAP[contribution.financial_type] || 'donation';
      const paymentStatus =
        CONTRIBUTION_STATUS_MAP[contribution.contribution_status] || 'pending';

      if (!dryRun) {
        const { error } = await supabase.from('rlc_contributions').upsert(
          {
            member_id: member.id,
            contribution_type: contributionType,
            amount: contribution.total_amount,
            currency: contribution.currency || 'USD',
            payment_status: paymentStatus,
            payment_method: contribution.payment_method || null,
            transaction_id: contribution.transaction_id || null,
            source: contribution.source || null,
            is_recurring: contribution.contribution_recur_id != null,
            campaign_id: contribution.campaign_id ? String(contribution.campaign_id) : null,
            civicrm_contribution_id: contribution.civicrm_contribution_id,
            created_at: contribution.receive_date,
          } as never,
          { onConflict: 'civicrm_contribution_id' }
        );

        if (error) {
          throw error;
        }
      }

      result.success++;

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

// ===========================================
// Household migration
// ===========================================

async function migrateHouseholds(
  relationships: CiviCRMRelationship[],
  dryRun: boolean = false
): Promise<MigrationResult> {
  console.log(`\nMigrating ${relationships.length} household relationships...`);

  const result: MigrationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  // Group relationships by primary member (head of household / paying member)
  // CiviCRM stores: contact_id_a IS <relationship> OF contact_id_b
  // "Spouse of" — A is spouse of B (B is primary)
  // "Child of" — A is child of B (B is primary)
  // "Head of Household for" — A is head of household for B (A is primary)

  // Build household groups: primary_contact_id → [dependent_contact_ids with roles]
  const households = new Map<number, Array<{ contactId: number; role: 'spouse' | 'child' }>>();

  for (const rel of relationships) {
    const relName = rel.name_a_b.toLowerCase();

    if (relName === 'spouse of') {
      // A is spouse of B — B is the primary (or whichever has the paying membership)
      // We'll use B as primary for now; membership tier check follows
      if (!households.has(rel.contact_id_b)) {
        households.set(rel.contact_id_b, []);
      }
      households.get(rel.contact_id_b)!.push({ contactId: rel.contact_id_a, role: 'spouse' });
    } else if (relName === 'child of') {
      // A is child of B — B is primary
      if (!households.has(rel.contact_id_b)) {
        households.set(rel.contact_id_b, []);
      }
      households.get(rel.contact_id_b)!.push({ contactId: rel.contact_id_a, role: 'child' });
    } else if (relName === 'head of household for') {
      // A is head of household for B — A is primary
      if (!households.has(rel.contact_id_a)) {
        households.set(rel.contact_id_a, []);
      }
      households.get(rel.contact_id_a)!.push({ contactId: rel.contact_id_b, role: 'spouse' }); // default to spouse
    }
  }

  console.log(`  Found ${households.size} household groups`);

  for (const [primaryContactId, dependents] of households) {
    try {
      // Look up the primary member
      const { data: primaryMember } = await supabase
        .from('rlc_contacts')
        .select('id, membership_tier')
        .eq('civicrm_contact_id', primaryContactId)
        .single();

      if (!primaryMember) {
        result.skipped++;
        continue;
      }

      // Only Premium and Sustaining tiers support households
      const tier = primaryMember.membership_tier;
      if (tier !== 'premium' && tier !== 'sustaining') {
        // Log the skipped household for visibility
        console.log(`  Skipped: contact ${primaryContactId} has ${dependents.length} family relationship(s) but tier "${tier}" does not support households`);
        result.skipped++;
        continue;
      }

      const householdId = crypto.randomUUID();

      if (dryRun) {
        console.log(`  [DRY RUN] Household for contact ${primaryContactId}: ${dependents.length} dependents (${tier})`);
      } else {
        // Set primary member's household fields
        await supabase
          .from('rlc_contacts')
          .update({
            household_id: householdId,
            household_role: 'primary',
            primary_member_id: null,
          })
          .eq('id', primaryMember.id);

        // Set each dependent's household fields
        for (const dep of dependents) {
          // Premium: only 1 spouse allowed, no children
          if (tier === 'premium' && dep.role === 'child') {
            result.errors.push(
              `Household for contact ${primaryContactId}: Skipped child ${dep.contactId} (Premium tier does not support children)`
            );
            result.skipped++;
            continue;
          }

          const { data: depMember } = await supabase
            .from('rlc_contacts')
            .select('id')
            .eq('civicrm_contact_id', dep.contactId)
            .single();

          if (depMember) {
            await supabase
              .from('rlc_contacts')
              .update({
                household_id: householdId,
                household_role: dep.role,
                primary_member_id: primaryMember.id,
              })
              .eq('id', depMember.id);
          }
        }
      }

      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push(
        `Household for contact ${primaryContactId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return result;
}

// ===========================================
// Validation
// ===========================================

async function validateMigration(): Promise<void> {
  console.log('\n=== Migration Validation ===\n');

  // Count members
  const { count: memberCount } = await supabase
    .from('rlc_contacts')
    .select('*', { count: 'exact', head: true });

  // Count migrated members (those with CiviCRM ID)
  const { count: migratedMemberCount } = await supabase
    .from('rlc_contacts')
    .select('*', { count: 'exact', head: true })
    .not('civicrm_contact_id', 'is', null);

  // Count chapters
  const { count: chapterCount } = await supabase
    .from('rlc_chapters')
    .select('*', { count: 'exact', head: true });

  // Count contributions
  const { count: contributionCount } = await supabase
    .from('rlc_contributions')
    .select('*', { count: 'exact', head: true });

  // Sum contributions
  const { data: contributionSum } = await supabase
    .from('rlc_contributions')
    .select('amount')
    .eq('payment_status', 'completed');

  const totalContributions =
    contributionSum?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  // Count households
  const { data: householdData } = await supabase
    .from('rlc_contacts')
    .select('household_id')
    .not('household_id', 'is', null);

  const uniqueHouseholds = new Set((householdData || []).map((m) => m.household_id));

  // Count by tier
  const { data: tierData } = await supabase
    .from('rlc_contacts')
    .select('membership_tier');

  const tierCounts: Record<string, number> = {};
  for (const m of tierData || []) {
    tierCounts[m.membership_tier] = (tierCounts[m.membership_tier] || 0) + 1;
  }

  // Count by status
  const { data: statusData } = await supabase
    .from('rlc_contacts')
    .select('membership_status');

  const statusCounts: Record<string, number> = {};
  for (const m of statusData || []) {
    statusCounts[m.membership_status] = (statusCounts[m.membership_status] || 0) + 1;
  }

  // Check migration log
  const { data: migrationStats } = await supabase
    .from('rlc_civicrm_migration_log')
    .select('entity_type, status')
    .order('entity_type');

  const logByType = migrationStats?.reduce(
    (acc, log) => {
      acc[log.entity_type] = acc[log.entity_type] || { completed: 0, failed: 0 };
      acc[log.entity_type][log.status === 'completed' ? 'completed' : 'failed']++;
      return acc;
    },
    {} as Record<string, { completed: number; failed: number }>
  );

  console.log('Supabase Counts:');
  console.log(`  Total Members: ${memberCount}`);
  console.log(`  Migrated Members (with CiviCRM ID): ${migratedMemberCount}`);
  console.log(`  Chapters: ${chapterCount}`);
  console.log(`  Contributions: ${contributionCount}`);
  console.log(`  Contribution Total: $${totalContributions.toFixed(2)}`);
  console.log(`  Households: ${uniqueHouseholds.size}`);

  console.log('\nMember Tier Breakdown:');
  for (const [tier, count] of Object.entries(tierCounts).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${tier}: ${count}`);
  }

  console.log('\nMember Status Breakdown:');
  for (const [status, count] of Object.entries(statusCounts).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('\nMigration Log Summary:');
  for (const [type, stats] of Object.entries(logByType || {})) {
    console.log(`  ${type}: ${stats.completed} completed, ${stats.failed} failed`);
  }
}

// ===========================================
// Data loading
// ===========================================

function loadDataFile<T>(filename: string): T[] {
  const filePath = path.join(process.cwd(), 'scripts', 'civicrm', 'data', filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`  Data file not found: ${filename} (skipping)`);
    return [];
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(data);
  console.log(`  Loaded ${parsed.length} records from ${filename}`);
  return parsed;
}

function printResult(label: string, result: MigrationResult): void {
  console.log(`\n${label}: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`);
  if (result.errors.length > 0) {
    const showCount = Math.min(result.errors.length, 10);
    console.log(`  First ${showCount} errors:`);
    for (const err of result.errors.slice(0, showCount)) {
      console.log(`    - ${err}`);
    }
    if (result.errors.length > showCount) {
      console.log(`    ... and ${result.errors.length - showCount} more`);
    }
  }
}

// ===========================================
// Main
// ===========================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const validateOnly = args.includes('--validate');
  const contactsOnly = args.includes('--contacts');
  const chaptersOnly = args.includes('--chapters');
  const householdsOnly = args.includes('--households');

  console.log('===========================================');
  console.log('CiviCRM to Supabase Migration');
  console.log('===========================================');

  if (dryRun) {
    console.log('MODE: Dry Run (no data will be written)');
  }

  if (validateOnly) {
    await validateMigration();
    return;
  }

  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), 'scripts', 'civicrm', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('\nCreated data directory. Please add exported JSON files:');
    console.log('  - contacts.json');
    console.log('  - memberships.json');
    console.log('  - contributions.json');
    console.log('  - groups.json');
    console.log('  - group_contacts.json');
    console.log('  - relationships.json');
    return;
  }

  console.log('\nLoading data files...');

  // Load all data files
  const groups = loadDataFile<CiviCRMGroup>('groups.json');
  const groupContacts = loadDataFile<CiviCRMGroupContact>('group_contacts.json');
  const contacts = loadDataFile<CiviCRMContact>('contacts.json');
  const memberships = loadDataFile<CiviCRMMembership>('memberships.json');
  const contributions = loadDataFile<CiviCRMContribution>('contributions.json');
  const relationships = loadDataFile<CiviCRMRelationship>('relationships.json');

  // Chapters only
  if (chaptersOnly) {
    if (groups.length > 0) {
      const chapterResult = await migrateChapters(groups, dryRun);
      printResult('Chapters', chapterResult);
    }
    return;
  }

  // Contacts only
  if (contactsOnly) {
    if (contacts.length > 0) {
      const contactResult = await migrateContacts(contacts, groupContacts, dryRun);
      printResult('Contacts', contactResult);
    }
    await validateMigration();
    return;
  }

  // Households only
  if (householdsOnly) {
    if (relationships.length > 0) {
      const householdResult = await migrateHouseholds(relationships, dryRun);
      printResult('Households', householdResult);
    }
    return;
  }

  // Full migration: chapters → contacts → memberships → contributions → households

  // 1. Chapters
  if (groups.length > 0) {
    const chapterResult = await migrateChapters(groups, dryRun);
    printResult('Chapters', chapterResult);
  }

  // 2. Contacts
  if (contacts.length > 0) {
    const contactResult = await migrateContacts(contacts, groupContacts, dryRun);
    printResult('Contacts', contactResult);
  }

  // 3. Memberships (updates existing member records)
  if (memberships.length > 0) {
    const membershipResult = await migrateMemberships(memberships, dryRun);
    printResult('Memberships', membershipResult);
  }

  // 4. Contributions
  if (contributions.length > 0) {
    const contributionResult = await migrateContributions(contributions, dryRun);
    printResult('Contributions', contributionResult);
  }

  // 5. Households
  if (relationships.length > 0) {
    const householdResult = await migrateHouseholds(relationships, dryRun);
    printResult('Households', householdResult);
  }

  // Run validation
  await validateMigration();

  console.log('\n===========================================');
  console.log('Migration Complete');
  console.log('===========================================');
}

main().catch(console.error);
