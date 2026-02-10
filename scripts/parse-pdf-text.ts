/**
 * Parse pdftotext -layout output from Liberty Index PDFs into compact seed format.
 *
 * Usage:
 *   pdftotext -layout "path/to/scorecard.pdf" /tmp/out.txt
 *   npx tsx scripts/parse-pdf-text.ts /tmp/out.txt <chamber> > output.ts
 *
 * The script identifies vote matrix rows by looking for patterns like:
 *   Name   District   1  1  1  0  NV  ...  Total  Score
 */

import * as fs from 'fs';
import * as path from 'path';

function main() {
  const inputPath = process.argv[2];
  const chamber = process.argv[3] || 'us_house';

  if (!inputPath) {
    console.error('Usage: npx tsx scripts/parse-pdf-text.ts <text-file> <chamber>');
    process.exit(1);
  }

  const text = fs.readFileSync(path.resolve(inputPath), 'utf-8');
  const lines = text.split('\n');

  // State abbreviations + district patterns
  const stateAbbrs = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';

  // For House: district = STATE-NUM or just STATE (for at-large like AK, ND, etc.)
  // For Senate: district = STATE
  const districtPattern = chamber.includes('house')
    ? new RegExp(`(${stateAbbrs})(?:-(\\d+))?`)
    : new RegExp(`(${stateAbbrs})\\b`);

  // Match rows: Name  District  (votes...)  Total  Score
  // Votes are 0, 1, NV, or NA separated by whitespace
  const voteValues = /(?:^|\s)(0|1|NV|NA)(?=\s|$)/g;

  const rows: Array<{
    name: string;
    district: string;
    state: string;
    districtNum: string;
    alignments: string[];
    total: number;
    score: number;
  }> = [];

  for (const line of lines) {
    // Skip empty or header lines
    if (!line.trim() || line.includes('Liberty Index') || line.includes('H.Con.Res') ||
        line.includes('H.R.') || line.includes('S.J.Res') || line.includes('S. 1') ||
        line.includes('Representative') || line.includes('Senator') ||
        line.includes('Total') || line.includes('REPUBLICAN')) {
      continue;
    }

    // Look for district pattern
    const distMatch = line.match(new RegExp(`\\s+((?:${stateAbbrs})(?:-\\d+)?)\\s+`));
    if (!distMatch) continue;

    const district = distMatch[1];
    const stMatch = district.match(districtPattern);
    if (!stMatch) continue;

    const state = stMatch[1];
    const districtNum = stMatch[2] || '';

    // Extract name (everything before the district)
    const distIndex = line.indexOf(distMatch[0]);
    const rawName = line.substring(0, distIndex).trim();
    if (!rawName || rawName.length < 3) continue;

    // Extract all vote values and the score/total from after the district
    const afterDistrict = line.substring(distIndex + distMatch[0].length);

    // Split by whitespace and identify values
    const tokens = afterDistrict.trim().split(/\s+/);

    // All Liberty Index scorecards have exactly 20 bills.
    // Tokens are: vote1..vote20, total, score [, pct]
    // Vote values: 0, 1, NV, NA
    // We take exactly 20 vote-like tokens, then the rest are total/score.
    const MAX_BILLS = 20;
    const voteTokens: string[] = [];
    const trailingTokens: string[] = [];

    for (const token of tokens) {
      if (voteTokens.length < MAX_BILLS && (token === '0' || token === '1' || token === 'NV' || token === 'NA')) {
        voteTokens.push(token);
      } else {
        trailingTokens.push(token);
      }
    }

    // Parse trailing tokens as numeric values (total, score, optional pct)
    const numericTokens: number[] = [];
    for (const token of trailingTokens) {
      const num = parseFloat(token);
      if (!isNaN(num)) {
        numericTokens.push(num);
      }
    }

    // The last two numeric values should be total and score
    // Score can be 0.XX (2021-2022) or 0-100 integer (2023+)
    if (numericTokens.length < 1) continue;

    let score = numericTokens[numericTokens.length - 1];
    // Normalize: if score > 1, it's a percentage (2023+ format)
    if (score > 1) score = score / 100;
    // Score should be between 0 and 1
    if (score < 0 || score > 1.01) continue;

    // Total is the integer count of votes with RLC.
    // Format variants:
    //   2021-2022: ... total  score(0.XX)       → 2 numeric tokens
    //   2023+:     ... total  score(0.XX)  pct  → 3 numeric tokens
    //   2023+ senate: ... total  pct             → 2 numeric tokens (both int)
    let total: number;
    if (numericTokens.length >= 3) {
      // First numeric is the total
      total = numericTokens[0];
    } else if (numericTokens.length >= 2) {
      // Second-to-last is the total
      total = numericTokens[numericTokens.length - 2];
    } else {
      total = voteTokens.filter(v => v === '1').length;
    }

    // Skip rows with too few votes (probably not a data row)
    if (voteTokens.length < 10) continue;

    // Convert name to "Last, First" format
    const nameParts = rawName.split(/\s+/);
    let formattedName: string;
    if (nameParts.length >= 2) {
      const last = nameParts[nameParts.length - 1];
      const first = nameParts.slice(0, -1).join(' ');
      formattedName = `${last}, ${first}`;
    } else {
      formattedName = rawName;
    }

    // Handle special multi-word last names
    const specialLastNames: Record<string, string> = {
      'Herrera Beutler, Jaime': 'Herrera Beutler, Jaime',
      'Beutler, Jaime Herrera': 'Herrera Beutler, Jaime',
      'Hyde-Smith, Cindy': 'Hyde-Smith, Cindy',
      'Taylor Greene, Marjorie': 'Taylor Greene, Marjorie',
      'Greene, Marjorie Taylor': 'Taylor Greene, Marjorie',
      'Van Drew, Jefferson': 'Van Drew, Jefferson',
      'Drew, Jefferson Van': 'Van Drew, Jefferson',
      'Van Duyne, Beth': 'Van Duyne, Beth',
      'Duyne, Beth Van': 'Van Duyne, Beth',
      'Diaz-Balart, Mario': 'Diaz-Balart, Mario',
      'Balart, Mario Diaz-': 'Diaz-Balart, Mario',
      'Miller-Meeks, Mariannette': 'Miller-Meeks, Mariannette',
      'Meeks, Mariannette Miller-': 'Miller-Meeks, Mariannette',
    };

    if (specialLastNames[formattedName]) {
      formattedName = specialLastNames[formattedName];
    }

    rows.push({
      name: formattedName,
      district,
      state,
      districtNum,
      alignments: voteTokens,
      total: Math.round(total),
      score,
    });
  }

  // Validate and output
  let errors = 0;
  for (const row of rows) {
    const actualTotal = row.alignments.filter(v => v === '1').length;
    if (actualTotal !== row.total) {
      console.error(`MISMATCH: ${row.name} (${row.district}): computed ${actualTotal} vs stated ${row.total} (score ${row.score})`);
      errors++;
    }
  }

  console.error(`\nParsed ${rows.length} legislators, ${errors} validation errors`);

  // Output as compact format
  console.log('// Auto-extracted from PDF via pdftotext');
  console.log('// Legislators:');
  for (const row of rows) {
    const alignStr = row.alignments.map(v => v === 'NV' ? 'N' : v === 'NA' ? 'A' : v).join(',');
    console.log(`    { name: '${row.name.replace(/'/g, "\\'")}', state: '${row.state}', expected_total: ${row.total}, alignments: '${alignStr}' },`);
  }
}

main();
