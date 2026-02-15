/**
 * Charter Data Cleanup Script
 *
 * Removes 18 CiviCRM group records that were imported as charters but are
 * actually mailing-list groups, not real organizational charters. Reassigns
 * their members to the correct state charter and activates the 29 real state
 * charters plus national.
 *
 * Usage:
 *   pnpm cleanup:charters --dry-run   # Preview changes (always creates backup)
 *   pnpm cleanup:charters             # Apply changes
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

// CiviCRM group IDs that were imported as charters but are actually mailing-list groups
const CIVICRM_GROUP_IDS = [
  182,  // Chartered States
  338,  // FL - RLC of Daytona Beach
  234,  // FL - RLCCEF (Florida Region 6)
  231,  // FL - RLCCF (Florida Region 5)
  229,  // FL - RLCCWF (Florida Region 4)
  237,  // FL - RLCNCF (Florida Region 2)
  230,  // FL - RLCNEF (Florida Region 3)
  236,  // FL - RLCNWF (Florida Region 1)
  235,  // FL - RLCSEF (Florida Region 8)
  232,  // FL - RLCSWF (Florida Region 7)
  337,  // RLC of Greater Melrose (FL child)
  329,  // RLCFL Board
  339,  // RLCFL East Volusia
  5,    // State Board Members
  225,  // State Board Members (SG)
  4,    // State Officers
  224,  // State Officers (SG)
  220,  // TX-CBRLC (Coastal Bend RLC)
];

// The 29 state charters + national to activate (matched by state_code or charter_level=national)
const ACTIVE_STATE_CODES = [
  'AL', 'AK', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI',
  'IN', 'KS', 'KY', 'MA', 'MN', 'MO', 'NV', 'NJ', 'NY', 'NC',
  'OH', 'OR', 'PA', 'RI', 'SC', 'SD', 'TX', 'VA', 'WA',
];

interface CharterRow {
  id: string;
  name: string;
  slug: string;
  charter_level: string;
  state_code: string | null;
  status: string;
  metadata: Record<string, unknown>;
}

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  state: string | null;
  primary_charter_id: string | null;
}

async function main() {
  console.log(`\n========================================`);
  console.log(`  Charter Cleanup Script`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`========================================\n`);

  // 1. Fetch all charters
  const { data: allCharters, error: charterError } = await supabase
    .from('rlc_charters')
    .select('id, name, slug, charter_level, state_code, status, metadata')
    .order('name');

  if (charterError || !allCharters) {
    console.error('Failed to fetch charters:', charterError?.message);
    process.exit(1);
  }

  const charters = allCharters as CharterRow[];
  console.log(`Found ${charters.length} total charters in database\n`);

  // 2. Identify CiviCRM group charters by metadata.civicrm_group_id
  const civicrmCharters = charters.filter((ch) => {
    const groupId = ch.metadata?.civicrm_group_id;
    return groupId && CIVICRM_GROUP_IDS.includes(groupId as number);
  });

  console.log(`Found ${civicrmCharters.length} CiviCRM group charters to remove:`);
  for (const ch of civicrmCharters) {
    console.log(`  - ${ch.name} (group_id: ${ch.metadata.civicrm_group_id}, status: ${ch.status})`);
  }

  if (civicrmCharters.length === 0) {
    console.log('\nNo CiviCRM group charters found — they may have already been cleaned up.');
  }

  // 3. Fetch members assigned to these CiviCRM charters
  const civicrmCharterIds = civicrmCharters.map((ch) => ch.id);
  let affectedMembers: MemberRow[] = [];

  if (civicrmCharterIds.length > 0) {
    const { data: membersData, error: membersError } = await supabase
      .from('rlc_contacts')
      .select('id, first_name, last_name, state, primary_charter_id')
      .in('primary_charter_id', civicrmCharterIds);

    if (membersError) {
      console.error('Failed to fetch affected members:', membersError.message);
      process.exit(1);
    }

    affectedMembers = (membersData || []) as MemberRow[];
    console.log(`\n${affectedMembers.length} members currently assigned to CiviCRM group charters`);
  }

  // 4. Build state_code → charter_id map for reassignment
  const stateCharterMap = new Map<string, string>();
  for (const ch of charters) {
    if (ch.charter_level === 'state' && ch.state_code) {
      // Prefer real state charters over CiviCRM ones
      if (!civicrmCharterIds.includes(ch.id)) {
        stateCharterMap.set(ch.state_code, ch.id);
      }
    }
  }
  // Also add CiviCRM state charters as fallback if no real state charter exists
  for (const ch of charters) {
    if (ch.charter_level === 'state' && ch.state_code && !stateCharterMap.has(ch.state_code)) {
      stateCharterMap.set(ch.state_code, ch.id);
    }
  }

  // Find the national charter
  const nationalCharter = charters.find((ch) => ch.charter_level === 'national');

  // 5. Create backup before any changes
  const dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const backupPath = path.join(
    dataDir,
    `civicrm-charters-backup-${new Date().toISOString().slice(0, 10)}.json`
  );

  const backupData = {
    timestamp: new Date().toISOString(),
    civicrmCharters,
    affectedMembers: affectedMembers.map((m) => ({
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
      state: m.state,
      previous_charter_id: m.primary_charter_id,
    })),
    stateCharterMap: Object.fromEntries(stateCharterMap),
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`\nBackup written to: ${backupPath}`);

  if (civicrmCharters.length === 0 && affectedMembers.length === 0) {
    console.log('\nNo CiviCRM charters to clean up. Proceeding to activation step.\n');
  }

  // 6. Reassign members from CiviCRM group charters to proper state charters
  let reassigned = 0;
  let unmatched = 0;

  if (affectedMembers.length > 0) {
    console.log(`\nReassigning ${affectedMembers.length} members...`);

    for (const member of affectedMembers) {
      // Determine target charter: match by member's state field
      let targetCharterId: string | null = null;

      if (member.state) {
        targetCharterId = stateCharterMap.get(member.state) || null;
      }

      // Fallback to national charter
      if (!targetCharterId && nationalCharter) {
        targetCharterId = nationalCharter.id;
      }

      if (!targetCharterId) {
        console.log(`  [WARN] No target for ${member.first_name} ${member.last_name} (state: ${member.state || 'none'})`);
        unmatched++;
        continue;
      }

      // Skip if already assigned to the target
      if (member.primary_charter_id === targetCharterId) {
        continue;
      }

      const targetName = charters.find((ch) => ch.id === targetCharterId)?.name || targetCharterId;

      if (DRY_RUN) {
        console.log(`  [DRY RUN] ${member.first_name} ${member.last_name} → ${targetName}`);
      } else {
        const { error: updateError } = await supabase
          .from('rlc_contacts')
          .update({ primary_charter_id: targetCharterId })
          .eq('id', member.id);

        if (updateError) {
          console.error(`  [ERROR] ${member.first_name} ${member.last_name}: ${updateError.message}`);
          continue;
        }
      }

      reassigned++;
    }

    console.log(`  Reassigned: ${reassigned}, Unmatched: ${unmatched}`);
  }

  // 7. Delete duplicate national charters (keep one)
  const nationalCharters = charters.filter((ch) => ch.charter_level === 'national');
  if (nationalCharters.length > 1) {
    // Keep the first one (usually the "real" one), delete duplicates
    const toDelete = nationalCharters.slice(1);
    console.log(`\nFound ${nationalCharters.length} national charters, keeping "${nationalCharters[0].name}", removing ${toDelete.length} duplicates`);

    for (const dup of toDelete) {
      if (!DRY_RUN) {
        // Move any members from the duplicate to the primary national charter
        const { error: moveError } = await supabase
          .from('rlc_contacts')
          .update({ primary_charter_id: nationalCharters[0].id })
          .eq('primary_charter_id', dup.id);

        if (moveError) {
          console.error(`  [ERROR] Failed to reassign members from "${dup.name}": ${moveError.message}`);
          console.error(`  Skipping deletion of "${dup.name}" to prevent orphaned members`);
          continue;
        }

        const { error: deleteError } = await supabase
          .from('rlc_charters')
          .delete()
          .eq('id', dup.id);

        if (deleteError) {
          console.error(`  [ERROR] Failed to delete duplicate national charter "${dup.name}": ${deleteError.message}`);
        } else {
          console.log(`  Deleted duplicate: "${dup.name}"`);
        }
      } else {
        console.log(`  [DRY RUN] Would delete duplicate: "${dup.name}"`);
      }
    }
  }

  // 8. Delete CiviCRM group charters
  if (civicrmCharterIds.length > 0) {
    console.log(`\nDeleting ${civicrmCharterIds.length} CiviCRM group charters...`);

    if (DRY_RUN) {
      for (const ch of civicrmCharters) {
        console.log(`  [DRY RUN] Would delete: "${ch.name}"`);
      }
    } else {
      // Clear member FK references before deletion
      const { error: memberCleanupError } = await supabase
        .from('rlc_contacts')
        .update({ primary_charter_id: nationalCharter?.id || null })
        .in('primary_charter_id', civicrmCharterIds);

      if (memberCleanupError) {
        console.error(`  [ERROR] Failed to clear member FK references: ${memberCleanupError.message}`);
        console.error('  Aborting charter deletion to prevent FK violations');
        process.exit(1);
      }

      // Clear child charter references before deletion
      const { error: childCleanupError } = await supabase
        .from('rlc_charters')
        .update({ parent_charter_id: null } as Record<string, unknown>)
        .in('parent_charter_id', civicrmCharterIds);

      if (childCleanupError) {
        console.error(`  [ERROR] Failed to clear child charter FK references: ${childCleanupError.message}`);
        console.error('  Aborting charter deletion to prevent FK violations');
        process.exit(1);
      }

      const { error: deleteError } = await supabase
        .from('rlc_charters')
        .delete()
        .in('id', civicrmCharterIds);

      if (deleteError) {
        console.error(`  [ERROR] Failed to delete CiviCRM charters: ${deleteError.message}`);
      } else {
        console.log(`  Deleted ${civicrmCharterIds.length} CiviCRM group charters`);
      }
    }
  }

  // 9. Activate 29 state charters + national
  console.log(`\nActivating state charters and national...`);

  // Activate national
  if (nationalCharter) {
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would activate national: "${nationalCharter.name}" (current: ${nationalCharter.status})`);
    } else {
      const { error: natError } = await supabase
        .from('rlc_charters')
        .update({ status: 'active' })
        .eq('id', nationalCharter.id);
      if (natError) {
        console.error(`  [ERROR] Failed to activate national: ${natError.message}`);
      } else {
        console.log(`  Activated: "${nationalCharter.name}"`);
      }
    }
  }

  // Activate state charters
  let activated = 0;
  for (const stateCode of ACTIVE_STATE_CODES) {
    const stateCharter = charters.find(
      (ch) => ch.charter_level === 'state' && ch.state_code === stateCode && !civicrmCharterIds.includes(ch.id)
    );

    if (!stateCharter) {
      console.log(`  [WARN] No charter found for state ${stateCode}`);
      continue;
    }

    if (stateCharter.status === 'active') {
      continue; // Already active
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would activate: "${stateCharter.name}" (${stateCode}, current: ${stateCharter.status})`);
    } else {
      const { error: stateError } = await supabase
        .from('rlc_charters')
        .update({ status: 'active' })
        .eq('id', stateCharter.id);
      if (stateError) {
        console.error(`  [ERROR] Failed to activate ${stateCharter.name}: ${stateError.message}`);
      }
    }

    activated++;
  }

  console.log(`  ${DRY_RUN ? 'Would activate' : 'Activated'}: ${activated} state charters`);

  // 10. Summary
  console.log(`\n========================================`);
  console.log(`  Summary`);
  console.log(`========================================`);
  console.log(`  CiviCRM charters removed: ${civicrmCharterIds.length}`);
  console.log(`  Members reassigned: ${reassigned} of ${affectedMembers.length}`);
  console.log(`  Members unmatched: ${unmatched}`);
  console.log(`  State charters activated: ${activated}`);
  console.log(`  Backup file: ${backupPath}`);
  if (DRY_RUN) {
    console.log(`\n  ** DRY RUN — no changes were made **`);
    console.log(`  Run without --dry-run to apply changes.`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
