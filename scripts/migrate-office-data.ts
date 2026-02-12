/**
 * Normalize existing candidate_office free-text into structured office_type_id references.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/migrate-office-data.ts
 *
 * Dry-run by default. Pass --apply to execute updates:
 *   tsx --env-file=.env.local scripts/migrate-office-data.ts --apply
 *
 * Also normalizes candidate_district by stripping common prefixes
 * (CD, HD, SD, TX-, etc.) and ordinal suffixes (th, st, nd, rd).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dryRun = !process.argv.includes('--apply');

// Maps free-text office values → office type slug
const OFFICE_MAPPINGS: Record<string, string> = {
  // Federal
  'congress': 'us-house',
  'congressman': 'us-house',
  'u.s. house': 'us-house',
  'u.s. house of representatives': 'us-house',
  'u.s. house of representatives ': 'us-house',
  'us house': 'us-house',
  'us house of representatives': 'us-house',
  'house of representatives': 'us-house',
  'representative': 'us-house',
  'us representative': 'us-house',
  'u.s. representative': 'us-house',
  'u.s. house representative': 'us-house',
  'u.s. house of representative': 'us-house',
  'u.s congress': 'us-house',
  'u.s. congress': 'us-house',
  'senate': 'us-senate',
  'u.s. senate': 'us-senate',
  'us senate': 'us-senate',
  'us senator': 'us-senate',
  'u.s. senator': 'us-senate',
  'president': 'president',

  // State
  'state representative': 'state-house',
  'state rep': 'state-house',
  'state house': 'state-house',
  'state assembly': 'state-house',
  'assemblyman': 'state-house',
  'assemblywoman': 'state-house',
  'assembly': 'state-house',
  'state senator': 'state-senate',
  'state senate': 'state-senate',
  'governor': 'governor',
  'lt governor': 'lieutenant-governor',
  'lt. governor': 'lieutenant-governor',
  'lieutenant governor': 'lieutenant-governor',
  'attorney general': 'attorney-general',
  'ag': 'attorney-general',
  'secretary of state': 'secretary-of-state',
  'state treasurer': 'state-treasurer',
  'state comptroller': 'state-comptroller',
  'state auditor': 'state-auditor',
  'superintendent of public instruction': 'superintendent-public-instruction',

  // County
  'sheriff': 'county-sheriff',
  'county sheriff': 'county-sheriff',
  'county commissioner': 'county-commissioner',
  'commissioner': 'county-commissioner',
  'county judge': 'county-judge',
  'county clerk': 'county-clerk',
  'county treasurer': 'county-treasurer',
  'county assessor': 'county-assessor',
  'property appraiser': 'county-assessor',
  'county tax collector': 'county-tax-collector',
  'tax collector': 'county-tax-collector',
  'supervisor of elections': 'county-supervisor-elections',
  'clerk of courts': 'county-clerk-of-courts',
  'county clerk of courts': 'county-clerk-of-courts',
  'district attorney': 'district-attorney',
  'da': 'district-attorney',
  "state's attorney": 'district-attorney',

  // Municipal
  'mayor': 'mayor',
  'city council': 'city-council',
  'city councilman': 'city-council',
  'city councilwoman': 'city-council',
  'alderman': 'city-council',
  'councilmember': 'city-council',

  // Judicial
  'circuit judge': 'circuit-judge',
  'district court judge': 'district-court-judge',

  // Special
  'school board': 'school-board',
  'school board member': 'school-board',
};

/**
 * Normalize a district string to just the number.
 * "CD8" → "8", "TX-16" → "16", "District 3" → "3", "66th" → "66"
 */
function normalizeDistrict(raw: string): string {
  let d = raw.trim();
  // Remove common prefixes
  d = d.replace(/^(CD|HD|SD|LD|AD)\s*[-.]?\s*/i, '');
  // Remove state prefix like "TX-", "FL-"
  d = d.replace(/^[A-Z]{2}\s*-\s*/i, '');
  // Remove "District", "Dist.", "Dist" prefix
  d = d.replace(/^dist(rict)?\.?\s*/i, '');
  // Remove ordinal suffixes
  d = d.replace(/(st|nd|rd|th)$/i, '');
  return d.trim();
}

async function main() {
  console.log(`\nMigrate Office Data — ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}\n`);

  // Load office type slugs → ids
  const { data: officeTypes, error: otError } = await supabase
    .from('rlc_office_types')
    .select('id, slug, name');

  if (otError || !officeTypes) {
    console.error('Failed to load office types:', otError);
    process.exit(1);
  }

  const slugToId = new Map(officeTypes.map((ot) => [ot.slug, ot.id]));
  const slugToName = new Map(officeTypes.map((ot) => [ot.slug, ot.name]));

  // Fetch candidate responses that have candidate_office set but no office_type_id
  const { data: responses, error: respError } = await supabase
    .from('rlc_candidate_responses')
    .select('id, candidate_name, candidate_office, candidate_district, office_type_id')
    .not('candidate_office', 'is', null);

  if (respError || !responses) {
    console.error('Failed to load candidate responses:', respError);
    process.exit(1);
  }

  console.log(`Found ${responses.length} candidate responses with office text\n`);

  let matched = 0;
  let skipped = 0;
  let alreadyMapped = 0;
  const unmatched: { id: string; name: string; office: string }[] = [];

  for (const r of responses) {
    if (r.office_type_id) {
      alreadyMapped++;
      continue;
    }

    const officeText = (r.candidate_office || '').trim().toLowerCase();
    let slug = OFFICE_MAPPINGS[officeText];

    // Fuzzy fallback: match patterns with embedded district/location info
    if (!slug) {
      if (/\b(us|u\.s\.?)\s*(house|representative|congress)/i.test(officeText) ||
          /\bcongressional\s*(seat|district)/i.test(officeText)) {
        slug = 'us-house';
      } else if (/\b(us|u\.s\.?)\s*senat/i.test(officeText)) {
        slug = 'us-senate';
      }
    }

    if (!slug) {
      unmatched.push({ id: r.id, name: r.candidate_name, office: r.candidate_office });
      continue;
    }

    const officeTypeId = slugToId.get(slug);
    if (!officeTypeId) {
      console.error(`  Slug "${slug}" not found in office types table!`);
      continue;
    }

    // Normalize district if present
    const normalizedDistrict = r.candidate_district
      ? normalizeDistrict(r.candidate_district)
      : null;

    console.log(`  ${r.candidate_name}: "${r.candidate_office}" → ${slugToName.get(slug)} (${slug})`);
    if (r.candidate_district && normalizedDistrict !== r.candidate_district) {
      console.log(`    District: "${r.candidate_district}" → "${normalizedDistrict}"`);
    }

    if (!dryRun) {
      const updates: Record<string, unknown> = { office_type_id: officeTypeId };
      if (normalizedDistrict !== null && normalizedDistrict !== r.candidate_district) {
        updates.candidate_district = normalizedDistrict;
      }

      const { error: updateError } = await supabase
        .from('rlc_candidate_responses')
        .update(updates)
        .eq('id', r.id);

      if (updateError) {
        console.error(`    ERROR updating ${r.id}:`, updateError);
        continue;
      }
    }

    matched++;
  }

  // Also update vettings that reference these responses
  if (!dryRun && matched > 0) {
    console.log('\nUpdating denormalized office_type_id on vettings...');

    const { data: vettings, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, candidate_response_id, candidate_office, candidate_district, office_type_id')
      .is('office_type_id', null)
      .not('candidate_office', 'is', null);

    if (!vettingError && vettings) {
      for (const v of vettings) {
        const officeText = (v.candidate_office || '').trim().toLowerCase();
        const slug = OFFICE_MAPPINGS[officeText];
        if (!slug) continue;

        const officeTypeId = slugToId.get(slug);
        if (!officeTypeId) continue;

        const normalizedDistrict = v.candidate_district
          ? normalizeDistrict(v.candidate_district)
          : null;

        const updates: Record<string, unknown> = { office_type_id: officeTypeId };
        if (normalizedDistrict !== null && normalizedDistrict !== v.candidate_district) {
          updates.candidate_district = normalizedDistrict;
        }

        const { error: updateError } = await supabase
          .from('rlc_candidate_vettings')
          .update(updates)
          .eq('id', v.id);

        if (updateError) {
          console.error(`  ERROR updating vetting ${v.id}:`, updateError);
        } else {
          console.log(`  Vetting ${v.id}: ${v.candidate_office} → ${slugToName.get(slug)}`);
        }
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`  Already mapped: ${alreadyMapped}`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\n  Unmatched records (need manual review):');
    for (const u of unmatched) {
      console.log(`    ${u.name}: "${u.office}" (id: ${u.id})`);
    }
  }

  if (dryRun) {
    console.log('\n  DRY RUN — no changes made. Pass --apply to execute.');
  } else {
    console.log('\n  Changes applied successfully.');
  }
}

main().catch(console.error);
