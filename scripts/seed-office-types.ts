/**
 * Seed office types reference table for structured candidate office selection.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/seed-office-types.ts
 *
 * Idempotent: Uses upsert on slug (unique constraint).
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface OfficeTypeSeed {
  level: string;
  name: string;
  slug: string;
  endorsing_charter_level: string;
  requires_state: boolean;
  requires_district: boolean;
  requires_county: boolean;
  district_label: string | null;
  sort_order: number;
  is_active: boolean;
}

const officeTypes: OfficeTypeSeed[] = [
  // === Federal (endorsing: national) ===
  { level: 'federal', name: 'President', slug: 'president', endorsing_charter_level: 'national', requires_state: false, requires_district: false, requires_county: false, district_label: null, sort_order: 100, is_active: true },
  { level: 'federal', name: 'US Senate', slug: 'us-senate', endorsing_charter_level: 'national', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 110, is_active: true },
  { level: 'federal', name: 'US House of Representatives', slug: 'us-house', endorsing_charter_level: 'national', requires_state: true, requires_district: true, requires_county: false, district_label: 'District', sort_order: 120, is_active: true },

  // === State (endorsing: state) ===
  { level: 'state', name: 'Governor', slug: 'governor', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 200, is_active: true },
  { level: 'state', name: 'Lieutenant Governor', slug: 'lieutenant-governor', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 210, is_active: true },
  { level: 'state', name: 'Attorney General', slug: 'attorney-general', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 220, is_active: true },
  { level: 'state', name: 'Secretary of State', slug: 'secretary-of-state', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 230, is_active: true },
  { level: 'state', name: 'State Treasurer', slug: 'state-treasurer', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 240, is_active: true },
  { level: 'state', name: 'State Comptroller', slug: 'state-comptroller', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 250, is_active: true },
  { level: 'state', name: 'State Auditor', slug: 'state-auditor', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 260, is_active: true },
  { level: 'state', name: 'Superintendent of Public Instruction', slug: 'superintendent-public-instruction', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 270, is_active: true },
  { level: 'state', name: 'Commissioner of Agriculture', slug: 'commissioner-agriculture', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 280, is_active: true },
  { level: 'state', name: 'Commissioner of Insurance', slug: 'commissioner-insurance', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 290, is_active: true },
  { level: 'state', name: 'State Senate', slug: 'state-senate', endorsing_charter_level: 'state', requires_state: true, requires_district: true, requires_county: false, district_label: 'District', sort_order: 300, is_active: true },
  { level: 'state', name: 'State House / Assembly', slug: 'state-house', endorsing_charter_level: 'state', requires_state: true, requires_district: true, requires_county: false, district_label: 'District', sort_order: 310, is_active: true },
  { level: 'state', name: 'Other Statewide Office', slug: 'other-statewide', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 390, is_active: true },

  // === County (endorsing: county, requires_county: true) ===
  { level: 'county', name: 'County Commissioner / Supervisor', slug: 'county-commissioner', endorsing_charter_level: 'county', requires_state: true, requires_district: true, requires_county: true, district_label: 'Precinct', sort_order: 400, is_active: true },
  { level: 'county', name: 'County Judge', slug: 'county-judge', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 410, is_active: true },
  { level: 'county', name: 'County Sheriff', slug: 'county-sheriff', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 420, is_active: true },
  { level: 'county', name: 'County Clerk', slug: 'county-clerk', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 430, is_active: true },
  { level: 'county', name: 'County Clerk of Courts', slug: 'county-clerk-of-courts', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 435, is_active: true },
  { level: 'county', name: 'County Treasurer', slug: 'county-treasurer', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 440, is_active: true },
  { level: 'county', name: 'County Assessor / Property Appraiser', slug: 'county-assessor', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 450, is_active: true },
  { level: 'county', name: 'County Tax Collector', slug: 'county-tax-collector', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 455, is_active: true },
  { level: 'county', name: 'County Supervisor of Elections', slug: 'county-supervisor-elections', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 460, is_active: true },
  { level: 'county', name: 'District Attorney / State\'s Attorney', slug: 'district-attorney', endorsing_charter_level: 'county', requires_state: true, requires_district: true, requires_county: true, district_label: 'District', sort_order: 470, is_active: true },
  { level: 'county', name: 'Other County Office', slug: 'other-county', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 490, is_active: true },

  // === Municipal (endorsing: county, requires_county: true) ===
  { level: 'municipal', name: 'Mayor', slug: 'mayor', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 500, is_active: true },
  { level: 'municipal', name: 'City Council / Alderman', slug: 'city-council', endorsing_charter_level: 'county', requires_state: true, requires_district: true, requires_county: true, district_label: 'Ward', sort_order: 510, is_active: true },
  { level: 'municipal', name: 'Other Municipal Office', slug: 'other-municipal', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 590, is_active: true },

  // === Judicial (endorsing: state — multi-county/statewide races) ===
  { level: 'judicial', name: 'State Supreme Court Justice', slug: 'state-supreme-court', endorsing_charter_level: 'state', requires_state: true, requires_district: true, requires_county: false, district_label: 'Seat', sort_order: 600, is_active: true },
  { level: 'judicial', name: 'State Appeals Court Judge', slug: 'state-appeals-court', endorsing_charter_level: 'state', requires_state: true, requires_district: true, requires_county: false, district_label: 'Seat', sort_order: 610, is_active: true },
  { level: 'judicial', name: 'Circuit Judge', slug: 'circuit-judge', endorsing_charter_level: 'state', requires_state: true, requires_district: true, requires_county: false, district_label: 'Circuit', sort_order: 620, is_active: true },
  { level: 'judicial', name: 'District Court Judge', slug: 'district-court-judge', endorsing_charter_level: 'state', requires_state: true, requires_district: true, requires_county: false, district_label: 'District', sort_order: 630, is_active: true },
  { level: 'judicial', name: 'Other Judicial Office', slug: 'other-judicial', endorsing_charter_level: 'state', requires_state: true, requires_district: false, requires_county: false, district_label: null, sort_order: 690, is_active: true },

  // === Special District (endorsing: county) ===
  { level: 'special_district', name: 'School Board Member', slug: 'school-board', endorsing_charter_level: 'county', requires_state: true, requires_district: true, requires_county: true, district_label: 'District', sort_order: 700, is_active: true },
  { level: 'special_district', name: 'Water District Board', slug: 'water-district', endorsing_charter_level: 'county', requires_state: true, requires_district: true, requires_county: true, district_label: 'District', sort_order: 710, is_active: true },
  { level: 'special_district', name: 'Other Special District', slug: 'other-special-district', endorsing_charter_level: 'county', requires_state: true, requires_district: false, requires_county: true, district_label: null, sort_order: 790, is_active: true },
];

async function main() {
  console.log(`Seeding ${officeTypes.length} office types...`);

  let created = 0;
  let updated = 0;

  for (const ot of officeTypes) {
    const now = new Date().toISOString();

    // Check if row exists to avoid overwriting the PK (which would break FK references)
    const { data: existing } = await supabase
      .from('rlc_office_types')
      .select('id')
      .eq('slug', ot.slug)
      .maybeSingle();

    if (existing) {
      // Update non-PK fields only
      const { error } = await supabase
        .from('rlc_office_types')
        .update({ ...ot, updated_at: now })
        .eq('id', existing.id);

      if (error) {
        console.error(`Failed to update ${ot.slug}:`, error.message);
        continue;
      }
      updated++;
    } else {
      // Insert with new ID
      const { error } = await supabase
        .from('rlc_office_types')
        .insert({ id: crypto.randomUUID(), ...ot, created_at: now, updated_at: now });

      if (error) {
        console.error(`Failed to insert ${ot.slug}:`, error.message);
        continue;
      }
      created++;
    }
  }

  console.log(`Done. Created ${created}, updated ${updated} office types.`);

  // Verify
  const { count } = await supabase
    .from('rlc_office_types')
    .select('*', { count: 'exact', head: true });

  console.log(`Total office types in database: ${count}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
