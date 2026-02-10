/**
 * Import scorecard data from a JSON seed file into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-scorecard.ts seeds/scorecards/2026-us-house.json
 *
 * The seed file format is documented in seeds/scorecards/README-FORMAT.md
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Types for seed file structure
interface SeedBill {
  bill_number: string;
  title: string;
  description?: string;
  liberty_position: 'yea' | 'nay';
  category?: string;
  weight?: number;
  sort_order: number;
  is_bonus?: boolean;
  bonus_point_value?: number;
  vote_result_summary?: string;
}

interface SeedLegislator {
  name: string;
  party: string;
  state_code: string;
  chamber: 'us_house' | 'us_senate' | 'state_house' | 'state_senate';
  district?: string;
  photo_url?: string;
  // votes keyed by bill_number: 'yea' | 'nay' | 'not_voting' | 'absent' | 'not_applicable'
  votes: Record<string, string>;
}

interface SeedFile {
  session: {
    name: string;
    slug: string;
    jurisdiction: 'federal' | 'state';
    state_code?: string;
    session_year: number;
    chamber: 'us_house' | 'us_senate' | 'state_house' | 'state_senate';
    description?: string;
    absence_penalty_threshold?: number;
  };
  bills: SeedBill[];
  legislators: SeedLegislator[];
}

async function main() {
  const seedPath = process.argv[2];
  if (!seedPath) {
    console.error('Usage: npx tsx scripts/import-scorecard.ts <seed-file.json>');
    process.exit(1);
  }

  const absolutePath = path.resolve(seedPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  let seed: SeedFile;
  try {
    seed = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse ${absolutePath}:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
  console.log(`Importing: ${seed.session.name}`);
  console.log(`  Bills: ${seed.bills.length}`);
  console.log(`  Legislators: ${seed.legislators.length}`);

  // 1. Upsert session
  const { data: sessionData, error: sessionError } = await supabase
    .from('rlc_scorecard_sessions')
    .upsert(
      {
        name: seed.session.name,
        slug: seed.session.slug,
        jurisdiction: seed.session.jurisdiction,
        state_code: seed.session.state_code || null,
        session_year: seed.session.session_year,
        chamber: seed.session.chamber,
        description: seed.session.description || null,
        absence_penalty_threshold: seed.session.absence_penalty_threshold ?? 3,
        status: 'published',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (sessionError || !sessionData) {
    console.error('Failed to upsert session:', sessionError?.message);
    process.exit(1);
  }

  const sessionId = sessionData.id;
  console.log(`  Session ID: ${sessionId}`);

  // 2. Upsert bills
  const billIdMap = new Map<string, string>(); // bill_number -> id

  for (const bill of seed.bills) {
    // Check if bill exists in this session
    const { data: existingBill } = await supabase
      .from('rlc_scorecard_bills')
      .select('id')
      .eq('session_id', sessionId)
      .eq('bill_number', bill.bill_number)
      .single();

    if (existingBill) {
      // Update
      const { error: updateError } = await supabase
        .from('rlc_scorecard_bills')
        .update({
          title: bill.title,
          description: bill.description || null,
          liberty_position: bill.liberty_position,
          category: bill.category || 'other',
          weight: bill.weight ?? 1,
          sort_order: bill.sort_order,
          is_bonus: bill.is_bonus ?? false,
          bonus_point_value: bill.bonus_point_value ?? 0,
          vote_result_summary: bill.vote_result_summary || null,
          bill_status: 'voted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBill.id);

      if (updateError) {
        console.error(`Failed to update bill ${bill.bill_number}:`, updateError.message);
        continue;
      }
      billIdMap.set(bill.bill_number, existingBill.id);
    } else {
      // Insert
      const { data: newBill, error: billError } = await supabase
        .from('rlc_scorecard_bills')
        .insert({
          session_id: sessionId,
          bill_number: bill.bill_number,
          title: bill.title,
          description: bill.description || null,
          liberty_position: bill.liberty_position,
          category: bill.category || 'other',
          weight: bill.weight ?? 1,
          sort_order: bill.sort_order,
          is_bonus: bill.is_bonus ?? false,
          bonus_point_value: bill.bonus_point_value ?? 0,
          vote_result_summary: bill.vote_result_summary || null,
          bill_status: 'voted',
        })
        .select()
        .single();

      if (billError || !newBill) {
        console.error(`Failed to insert bill ${bill.bill_number}:`, billError?.message);
        continue;
      }
      billIdMap.set(bill.bill_number, newBill.id);
    }
  }

  console.log(`  Bills upserted: ${billIdMap.size}`);

  // 3. Upsert legislators and their votes
  let legislatorsProcessed = 0;
  let votesInserted = 0;

  for (const leg of seed.legislators) {
    // Find or create legislator (match by name + state + chamber)
    const { data: existingLeg } = await supabase
      .from('rlc_legislators')
      .select('id')
      .eq('name', leg.name)
      .eq('state_code', leg.state_code)
      .eq('chamber', leg.chamber)
      .single();

    let legislatorId: string;

    if (existingLeg) {
      legislatorId = existingLeg.id;
      // Update photo if provided
      if (leg.photo_url) {
        const { error: photoError } = await supabase
          .from('rlc_legislators')
          .update({ photo_url: leg.photo_url, updated_at: new Date().toISOString() })
          .eq('id', legislatorId);
        if (photoError) {
          console.error(`Failed to update photo for ${leg.name}:`, photoError.message);
        }
      }
    } else {
      const { data: newLeg, error: legError } = await supabase
        .from('rlc_legislators')
        .insert({
          name: leg.name,
          party: leg.party,
          state_code: leg.state_code,
          chamber: leg.chamber,
          district: leg.district || null,
          photo_url: leg.photo_url || null,
        })
        .select()
        .single();

      if (legError || !newLeg) {
        console.error(`Failed to insert legislator ${leg.name}:`, legError?.message);
        continue;
      }
      legislatorId = newLeg.id;
    }

    legislatorsProcessed++;

    // Upsert votes
    const validVotes = ['yea', 'nay', 'not_voting', 'absent', 'present', 'not_applicable'];
    for (const [billNumber, voteChoice] of Object.entries(leg.votes)) {
      if (!validVotes.includes(voteChoice)) {
        console.error(`  Invalid vote "${voteChoice}" for ${leg.name} on ${billNumber}, skipping`);
        continue;
      }

      const billId = billIdMap.get(billNumber);
      if (!billId) {
        console.warn(`  Bill not found for vote: ${billNumber} (legislator: ${leg.name})`);
        continue;
      }

      // Look up the bill's liberty_position to compute alignment
      const bill = seed.bills.find((b) => b.bill_number === billNumber);
      if (!bill) {
        console.warn(`  Bill definition missing in seed for ${billNumber} (legislator: ${leg.name})`);
        continue;
      }

      let alignedWithLiberty = false;
      if (voteChoice === 'yea' || voteChoice === 'nay') {
        alignedWithLiberty = voteChoice === bill.liberty_position;
      }

      const { error: voteError } = await supabase
        .from('rlc_scorecard_votes')
        .upsert(
          {
            bill_id: billId,
            legislator_id: legislatorId,
            vote: voteChoice,
            aligned_with_liberty: alignedWithLiberty,
          },
          { onConflict: 'bill_id,legislator_id' }
        );

      if (voteError) {
        console.error(`  Vote error for ${leg.name} on ${billNumber}:`, voteError.message);
      } else {
        votesInserted++;
      }
    }
  }

  console.log(`  Legislators processed: ${legislatorsProcessed}`);
  console.log(`  Votes upserted: ${votesInserted}`);

  console.log('  Note: Run score computation via the admin UI or API to update cached scores.');
  console.log(`\nImport complete: ${seed.session.name}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
