/**
 * Generate all 9 seed JSON files from pdftotext output.
 *
 * 1. Extracts bill numbers and positions from "List of Bills" sections
 * 2. Extracts legislator alignment data from vote matrices
 * 3. Generates complete seed JSONs ready for import
 *
 * Usage:
 *   npx tsx scripts/generate-all-seeds.ts
 *
 * Prerequisites:
 *   All 9 PDFs must be extracted to /tmp/ via pdftotext -layout
 */

import * as fs from 'fs';
import * as path from 'path';

interface Bill {
  bill_number: string;
  title: string;
  description: string;
  liberty_position: 'yea' | 'nay';
  category: string;
  weight: number;
  sort_order: number;
  is_bonus: boolean;
  bonus_point_value: number;
  vote_result_summary: string;
}

interface Legislator {
  name: string;
  party: string;
  state_code: string;
  chamber: string;
  votes: Record<string, string>;
}

interface ScorecardConfig {
  textFile: string;
  slug: string;
  name: string;
  session_year: number;
  chamber: 'us_house' | 'us_senate';
  description: string;
}

const SCORECARDS: ScorecardConfig[] = [
  {
    textFile: '/tmp/2021-us-senate.txt',
    slug: '2021-us-senate',
    name: 'Liberty Index 2021 - U.S. Senate',
    session_year: 2021,
    chamber: 'us_senate',
    description: 'Created by the Republican Liberty Caucus, the 2021 Liberty Index is a liberty-focused legislative scorecard for the U.S. Senate. The Liberty Index scores Republican Senators on 20 pivotal bills/votes from 2021 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2021-us-house.txt',
    slug: '2021-us-house',
    name: 'Liberty Index 2021 - U.S. House',
    session_year: 2021,
    chamber: 'us_house',
    description: 'Created by the Republican Liberty Caucus, the 2021 Liberty Index is a liberty-focused legislative scorecard for the U.S. House. The Liberty Index scores Republican members of Congress on 20 pivotal bills/votes from 2021 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2022-us-senate.txt',
    slug: '2022-us-senate',
    name: 'Liberty Index 2022 - U.S. Senate',
    session_year: 2022,
    chamber: 'us_senate',
    description: 'Created by the Republican Liberty Caucus, the 2022 Liberty Index is a liberty-focused legislative scorecard for the U.S. Senate. The Liberty Index scores Republican Senators on 20 pivotal bills/votes from 2022 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2022-us-house.txt',
    slug: '2022-us-house',
    name: 'Liberty Index 2022 - U.S. House',
    session_year: 2022,
    chamber: 'us_house',
    description: 'Created by the Republican Liberty Caucus, the 2022 Liberty Index is a liberty-focused legislative scorecard for the U.S. House. The Liberty Index scores Republican members of Congress on 20 pivotal bills/votes from 2022 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2023-us-senate.txt',
    slug: '2023-us-senate',
    name: 'Liberty Index 2023 - U.S. Senate',
    session_year: 2023,
    chamber: 'us_senate',
    description: 'Created by the Republican Liberty Caucus, the 2023 Liberty Index is a liberty-focused legislative scorecard for the U.S. Senate. The Liberty Index scores Republican Senators on 20 pivotal bills/votes from 2023 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2023-us-house.txt',
    slug: '2023-us-house',
    name: 'Liberty Index 2023 - U.S. House',
    session_year: 2023,
    chamber: 'us_house',
    description: 'Created by the Republican Liberty Caucus, the 2023 Liberty Index is a liberty-focused legislative scorecard for the U.S. House. The Liberty Index scores Republican members of Congress on 20 pivotal bills/votes from 2023 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2024-us-senate.txt',
    slug: '2024-us-senate',
    name: 'Liberty Index 2024 - U.S. Senate',
    session_year: 2024,
    chamber: 'us_senate',
    description: 'Created by the Republican Liberty Caucus, the 2024 Liberty Index is a liberty-focused legislative scorecard for the U.S. Senate. The Liberty Index scores Republican Senators on 20 pivotal bills/votes from 2024 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2024-us-house.txt',
    slug: '2024-us-house',
    name: 'Liberty Index 2024 - U.S. House',
    session_year: 2024,
    chamber: 'us_house',
    description: 'Created by the Republican Liberty Caucus, the 2024 Liberty Index is a liberty-focused legislative scorecard for the U.S. House. The Liberty Index scores Republican members of Congress on 20 pivotal bills/votes from 2024 that either advance liberty or diminish liberty.',
  },
  {
    textFile: '/tmp/2025-us-house.txt',
    slug: '2025-us-house',
    name: 'Liberty Index 2025 - U.S. House',
    session_year: 2025,
    chamber: 'us_house',
    description: 'Created by the Republican Liberty Caucus, the 2025 Liberty Index is a liberty-focused legislative scorecard for the U.S. House. The Liberty Index scores Republican members of Congress on 20 pivotal bills/votes from the 119th Congress that either advance liberty or diminish liberty.',
  },
];

// Vote result detection patterns
const VOTE_OPEN_RE = /\((?:Passed|Failed|Cloture|Motion)/;
const VOTE_COMPLETE_RE = /\((?:Passed|Failed|Cloture|Motion)[^)]*\)\.?\s*$/;
const PAREN_CLOSE_RE = /\)\.?\s*$/;

/**
 * Find the index of the last line that closes a vote result in the given range.
 * Vote results are parenthetical expressions (e.g., "(Passed House 226-188...)")
 * that may span multiple lines. Returns -1 if no vote result found.
 */
function findVoteResultEnd(lines: string[], start: number, end: number, initialVoteOpen = false): number {
  let lastVoteEnd = -1;
  let voteOpen = initialVoteOpen;

  for (let i = start; i < end; i++) {
    const line = lines[i].trim();
    if (VOTE_COMPLETE_RE.test(line)) {
      lastVoteEnd = i;
      voteOpen = false;
    } else if (VOTE_OPEN_RE.test(line) && !VOTE_COMPLETE_RE.test(line)) {
      voteOpen = true;
    } else if (voteOpen && PAREN_CLOSE_RE.test(line)) {
      lastVoteEnd = i;
      voteOpen = false;
    }
  }

  return lastVoteEnd;
}

/**
 * Extract just the left-column content from a line.
 * PDF text has two columns separated by 3+ spaces: bill identifier (left) and description (right).
 */
function getLeftColumn(text: string): string {
  const trimmed = text.trim();
  const gapMatch = trimmed.match(/^(.+?)\s{3,}/);
  if (gapMatch) return gapMatch[1].trim();
  return trimmed;
}

/**
 * Find a bill number pattern in text. Returns the bill number or null.
 * Only looks at the left column of the line to avoid picking up description text.
 */
function findBillNumber(text: string): string | null {
  const leftCol = getLeftColumn(text);
  // Remove leading numbered prefix (1, 2, ... 20, B)
  const cleaned = leftCol.replace(/^\s*(?:\d{1,2}|B)\s+/, '');
  // Match standard bill patterns with optional spaces/periods
  const match = cleaned.match(/((?:H\.?\s*(?:Con\.?\s*)?(?:Res\.?|R\.?|J\.?\s*Res\.?)|S\.?\s*(?:Con\.?\s*)?(?:Res\.?|J\.?\s*Res\.?)?)[\s.]*\d+)/i);
  if (match) return match[1].trim();
  return null;
}

/**
 * Check if a line's left column is qualifier text (not description, not a bill number).
 * Uses exclusion-based approach: anything short enough that isn't a bill number
 * and doesn't start with common description words is a qualifier.
 */
function findQualifier(text: string): string | null {
  const leftCol = getLeftColumn(text);
  if (!leftCol.trim()) return null;
  // If it's a standard bill number, not a qualifier
  if (findBillNumber(leftCol)) return null;
  // If it's just a sort-order number (1-20, B), not a qualifier
  if (/^\s*(?:\d{1,2}|B)\s*$/.test(leftCol)) return null;
  // If it starts with common description words, it's description not qualifier
  if (/^(?:The |This |A |An |It |In |One|Per |After |While |Even |With |Among |To |For |Such |Nowhere|Approximately|Sen\. |Rep\.)/i.test(leftCol)) return null;
  // If it's a vote result parenthetical, not a qualifier
  if (/^\(.*(?:Passed|Failed|Signed|Cloture|Motion|vote)/i.test(leftCol)) return null;
  // If it's too long (>50 chars), it's probably description
  if (leftCol.length > 50) return null;
  return leftCol.trim();
}

function extractBills(text: string): Bill[] {
  const lines = text.split('\n');

  // Step 1: Collect all lines in bill sections
  const sectionLines: string[] = [];
  let inBillSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('List of Bills')) {
      inBillSection = true;
      continue;
    }

    // End: "Liberty Index 20XX" without "List of Bills" = vote matrix header
    if (inBillSection && /Liberty Index 20\d\d/.test(line) && !line.includes('List of Bills')) {
      inBillSection = false;
      continue;
    }

    if (!inBillSection) continue;

    // Skip header rows
    if (/^\s*Bill\s+/i.test(line) && /Position/i.test(line)) continue;
    if (/^\s*RLC\s*$/.test(line)) continue;
    if (!line.trim()) continue;

    // Skip note lines (start with *)
    if (/^\s*\*/.test(line)) continue;

    sectionLines.push(line);
  }

  // Step 2: Find all lines containing "Support" or "Oppose"
  const positionLineIndices: number[] = [];
  for (let i = 0; i < sectionLines.length; i++) {
    if (/\bSupport\b|\bOppose\b/.test(sectionLines[i])) {
      positionLineIndices.push(i);
    }
  }

  // Step 3: For each position marker, extract bill info
  const bills: Bill[] = [];

  for (let p = 0; p < positionLineIndices.length; p++) {
    const idx = positionLineIndices[p];
    const line = sectionLines[idx];
    const posMatch = line.match(/\b(Support|Oppose)\b/);
    if (!posMatch || posMatch.index === undefined) continue;

    const position = posMatch[1].toLowerCase();
    const beforePos = line.substring(0, posMatch.index).trim();
    const afterPos = line.substring(posMatch.index + posMatch[0].length).trim();

    // Determine range of lines belonging to this bill entry
    const prevPosIdx = p > 0 ? positionLineIndices[p - 1] : -1;
    const nextPosIdx = p + 1 < positionLineIndices.length ? positionLineIndices[p + 1] : sectionLines.length;

    // --- Extract bill number ---
    // 1. Try the current line (before the position keyword)
    let billNumber = findBillNumber(beforePos);
    let qualifierParts: string[] = [];

    // Check if beforePos has qualifier text after the bill number (use left column only)
    if (billNumber && beforePos.length > billNumber.length) {
      const leftCol = getLeftColumn(beforePos);
      const afterBillNum = leftCol.substring(leftCol.indexOf(billNumber) + billNumber.length).trim();
      if (afterBillNum) qualifierParts.push(afterBillNum);
    }

    // 2. If no bill number on current line, search preceding lines (back to previous position)
    if (!billNumber) {
      for (let j = idx - 1; j > prevPosIdx; j--) {
        const prevLine = sectionLines[j];
        const found = findBillNumber(prevLine);
        if (found) {
          billNumber = found;
          // Get qualifier text from left column only (not description in right column)
          const leftCol = getLeftColumn(prevLine);
          const afterNum = leftCol.substring(leftCol.indexOf(found) + found.length).trim();
          if (afterNum) qualifierParts.push(afterNum);
          // Check lines between the bill number line and the position line for qualifiers
          for (let k = j + 1; k < idx; k++) {
            const midLine = sectionLines[k];
            const qual = findQualifier(midLine);
            if (qual) qualifierParts.push(qual);
          }
          break;
        }
        // Check if this line is a qualifier (e.g., "Amendment #1")
        const qual = findQualifier(prevLine);
        if (qual) qualifierParts.unshift(qual);
      }
    }

    // 2b. If bill number came from a preceding line, check if beforePos is a qualifier
    //     e.g., "Amendment 1             Support ..." → beforePos = "Amendment 1"
    if (billNumber && !findBillNumber(beforePos) && beforePos) {
      const qual = findQualifier('  ' + beforePos); // add indent since findQualifier checks leftCol
      if (qual) qualifierParts.push(qual);
    }

    // 3. Check line(s) after position for qualifier continuation
    for (let j = idx + 1; j < Math.min(idx + 2, nextPosIdx); j++) {
      const nextLine = sectionLines[j];
      const qual = findQualifier(nextLine);
      if (qual) {
        qualifierParts.push(qual);
      } else {
        break; // Stop at first non-qualifier line
      }
    }

    // 4. Handle special non-standard identifiers
    if (!billNumber) {
      // Collect short left-column text from nearby lines (skip long description/vote result text)
      const allContext: string[] = [];
      for (let j = Math.max(0, prevPosIdx + 1); j <= idx; j++) {
        const lc = getLeftColumn(sectionLines[j]);
        if (lc && lc.length < 50 && !/^\(/.test(lc)) allContext.push(lc);
      }
      // Also check the line after position
      if (idx + 1 < nextPosIdx) {
        const lc = getLeftColumn(sectionLines[idx + 1]);
        if (lc && lc.length < 50 && !/^\(/.test(lc)) allContext.push(lc);
      }
      const contextStr = allContext.join(' ');
      if (/(?:Jim Jordan|Andy Biggs)\s+for/i.test(contextStr)) {
        billNumber = contextStr.match(/((?:Jim Jordan|Andy Biggs)\s+for\s+House\s+Speaker)/i)?.[1] || 'Special Vote';
        qualifierParts = [];
      } else if (/Table\s+Motion/i.test(contextStr)) {
        // Procedural vote like "Table Motion to Reconsider H.R.7888"
        // Combine qualifier parts + line-after text, removing sort numbers
        const parts = qualifierParts.filter(q => !/^\d{1,2}$/.test(q));
        if (idx + 1 < nextPosIdx) {
          const lc = getLeftColumn(sectionLines[idx + 1]);
          if (lc && lc.length < 50) parts.push(lc);
        }
        billNumber = parts.join(' ').replace(/\s+/g, ' ').trim();
        qualifierParts = [];
      }
    }

    // Build full bill identifier
    let fullBillId = billNumber || `unknown_${bills.length + 1}`;
    if (qualifierParts.length > 0) {
      fullBillId += ' ' + qualifierParts.join(' ');
    }
    // Clean up: remove duplicate words, extra spaces
    fullBillId = fullBillId.replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();

    // --- Extract description ---
    const descParts: string[] = [];

    // Text after position keyword on the same line
    if (afterPos) descParts.push(afterPos);

    // Lines between previous position and this one need to be split at the vote result
    // boundary. Lines up to and including the previous bill's vote result belong to the
    // PREVIOUS bill. Lines after the vote result belong to THIS bill.
    // Vote results may span multiple lines, e.g. "(Passed House...\nPresident)".
    // Check if the previous anchor's afterPos opened a multi-line vote result.
    let prevAnchorOpensVote = false;
    if (p > 0) {
      const prevLine = sectionLines[positionLineIndices[p - 1]];
      const prevPosMatch = prevLine.match(/\b(Support|Oppose)\b/);
      if (prevPosMatch && prevPosMatch.index !== undefined) {
        const prevAfterPos = prevLine.substring(prevPosMatch.index + prevPosMatch[0].length).trim();
        prevAnchorOpensVote = VOTE_OPEN_RE.test(prevAfterPos) && !VOTE_COMPLETE_RE.test(prevAfterPos);
      }
    }
    const voteEnd = findVoteResultEnd(sectionLines, prevPosIdx + 1, idx, prevAnchorOpensVote);
    const prevBillVoteResultIdx = voteEnd >= 0 ? voteEnd : prevPosIdx;

    // Collect only lines AFTER the previous bill's vote result as this bill's pre-description.
    // Use indentation to distinguish right-column description text (indent >= 15) from
    // left-column identifier/qualifier lines (indent < 15). This avoids incorrectly
    // skipping description lines that reference bill numbers (e.g., "H.R. 1 appropriates...").
    const preDescLines: string[] = [];
    for (let j = prevBillVoteResultIdx + 1; j < idx; j++) {
      const rawLine = sectionLines[j];
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const indent = rawLine.match(/^(\s*)/)?.[1].length || 0;
      if (indent >= 15) {
        preDescLines.push(trimmed);
      }
    }
    descParts.unshift(...preDescLines);

    // Lines after position until this bill's vote result or next bill entry.
    // If the anchor line itself already ends with a complete vote result, all post-lines
    // belong to the next bill — don't collect any.
    const anchorHasCompleteVoteResult = VOTE_COMPLETE_RE.test(afterPos);
    if (!anchorHasCompleteVoteResult) {
      // Track whether the anchor line opens a multi-line vote result
      let voteOpen = VOTE_OPEN_RE.test(afterPos) && !VOTE_COMPLETE_RE.test(afterPos);
      let qualifierLinesAfter = 0;
      for (let j = idx + 1; j < nextPosIdx; j++) {
        const nextLine = sectionLines[j].trim();
        // Skip qualifier lines we already consumed
        if (qualifierLinesAfter < qualifierParts.length && findQualifier(nextLine)) {
          qualifierLinesAfter++;
          continue;
        }
        descParts.push(nextLine);
        // Stop after the vote result closes — remaining lines belong to the next bill
        if (voteOpen && PAREN_CLOSE_RE.test(nextLine)) {
          break;
        }
        if (VOTE_COMPLETE_RE.test(nextLine)) {
          break;
        }
        // Track multi-line vote result opening
        if (VOTE_OPEN_RE.test(nextLine) && !VOTE_COMPLETE_RE.test(nextLine)) {
          voteOpen = true;
        }
      }
    }

    const fullDesc = descParts.join(' ').trim();

    // Extract vote result from description
    let voteResult = '';
    const voteMatch = fullDesc.match(/\(([^)]*(?:Passed|Failed|Signed|Motion)[^)]*)\)\s*$/);
    if (voteMatch) {
      voteResult = voteMatch[1].trim();
    }

    // Extract title (first sentence)
    const titleMatch = fullDesc.match(/^([^.]+\.?\s*)/);
    const title = titleMatch ? titleMatch[1].trim().replace(/\.$/, '') : fullDesc.substring(0, 100);

    // Detect bonus bills (B prefix on the position line, or non-standard votes like Speaker)
    const isBonusPrefix = /^\s*B\s+/i.test(line.substring(0, posMatch.index));
    const isBonusDesc = /bonus\s+point/i.test(fullDesc);
    const isBonus = isBonusPrefix || isBonusDesc;

    bills.push({
      bill_number: fullBillId,
      title: title.length > 200 ? title.substring(0, 200) : title,
      description: fullDesc.replace(/\s*\([^)]*(?:Passed|Failed|Signed|Motion)[^)]*\)\s*$/, '').trim(),
      liberty_position: position === 'support' ? 'yea' : 'nay',
      category: 'other',
      weight: isBonus ? 0 : 1,
      sort_order: bills.length + 1,
      is_bonus: isBonus,
      bonus_point_value: isBonus ? 2 : 0,
      vote_result_summary: voteResult,
    });
  }

  return bills;
}

function extractLegislators(text: string, chamber: string, billNumbers: string[]): Legislator[] {
  const lines = text.split('\n');
  const stateAbbrs = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';
  const MAX_BILLS = 20;
  const legislators: Legislator[] = [];

  for (const line of lines) {
    if (!line.trim() || line.includes('Liberty Index') || line.includes('Representative') ||
        line.includes('Senator') || line.includes('Total') || line.includes('REPUBLICAN') ||
        line.includes('H.Con.Res') || line.includes('H.R.') || line.includes('S.J.Res') ||
        line.includes('S. 1') || line.includes('S. 2') || line.includes('S. 3') ||
        line.includes('S. 4') || line.includes('S. 6') || line.includes('S. 8') ||
        line.includes('H.Res.') || line.includes('H.J.Res')) {
      continue;
    }

    // Look for district/state pattern
    const distMatch = line.match(new RegExp(`\\s+((?:${stateAbbrs})(?:-\\d+)?)\\s+`));
    if (!distMatch) continue;

    const district = distMatch[1];
    const stMatch = district.match(new RegExp(`(${stateAbbrs})`));
    if (!stMatch) continue;
    const state = stMatch[1];

    const distIndex = line.indexOf(distMatch[0]);
    const rawName = line.substring(0, distIndex).trim();
    if (!rawName || rawName.length < 3) continue;

    const afterDistrict = line.substring(distIndex + distMatch[0].length);
    const tokens = afterDistrict.trim().split(/\s+/);

    const voteTokens: string[] = [];
    const trailingTokens: string[] = [];

    for (const token of tokens) {
      if (voteTokens.length < MAX_BILLS && (token === '0' || token === '1' || token === 'NV' || token === 'NA')) {
        voteTokens.push(token);
      } else {
        trailingTokens.push(token);
      }
    }

    const numericTokens: number[] = [];
    for (const token of trailingTokens) {
      const num = parseFloat(token);
      if (!isNaN(num)) numericTokens.push(num);
    }

    let score = numericTokens[numericTokens.length - 1] || 0;
    if (score > 1) score = score / 100;
    if (score < 0 || score > 1.01) continue;

    let total: number;
    if (numericTokens.length >= 3) {
      total = numericTokens[0];
    } else if (numericTokens.length >= 2) {
      total = numericTokens[numericTokens.length - 2];
    } else {
      total = voteTokens.filter(v => v === '1').length;
    }

    if (voteTokens.length < 10) continue;

    // Validate total
    const actualTotal = voteTokens.filter(v => v === '1').length;
    if (actualTotal !== Math.round(total)) continue; // Skip rows with mismatched totals

    // Format name as "Last, First"
    const nameParts = rawName.split(/\s+/);
    let formattedName: string;
    if (nameParts.length >= 2) {
      const last = nameParts[nameParts.length - 1];
      const first = nameParts.slice(0, -1).join(' ');
      formattedName = `${last}, ${first}`;
    } else {
      formattedName = rawName;
    }

    // Convert alignment values to actual votes
    const votes: Record<string, string> = {};
    for (let i = 0; i < Math.min(voteTokens.length, billNumbers.length); i++) {
      const alignment = voteTokens[i];
      const billNum = billNumbers[i];
      // We need the bill's liberty_position to convert, but we don't have it here
      // Store raw alignment for now; we'll convert later
      if (alignment === 'NV') {
        votes[billNum] = 'not_voting';
      } else if (alignment === 'NA') {
        votes[billNum] = 'not_applicable';
      } else {
        votes[billNum] = alignment; // '1' or '0' - will be converted later
      }
    }

    legislators.push({
      name: formattedName,
      party: 'R',
      state_code: state,
      chamber,
      votes,
    });
  }

  return legislators;
}

function convertAlignmentToVote(alignment: string, libertyPosition: 'yea' | 'nay'): string {
  if (alignment === 'not_voting' || alignment === 'not_applicable') return alignment;
  if (alignment === '1') return libertyPosition;
  if (alignment === '0') return libertyPosition === 'yea' ? 'nay' : 'yea';
  return alignment; // already converted
}

function processScorecard(config: ScorecardConfig): void {
  if (!fs.existsSync(config.textFile)) {
    console.error(`  SKIP: ${config.textFile} not found`);
    return;
  }

  const text = fs.readFileSync(config.textFile, 'utf-8');

  // Extract bills
  const allBills = extractBills(text);
  if (allBills.length === 0) {
    console.error(`  ERROR: No bills found in ${config.slug}`);
    return;
  }

  // Separate regular bills from bonus bills
  const regularBills = allBills.filter(b => !b.is_bonus);
  const bonusBills = allBills.filter(b => b.is_bonus);
  const bills = [...regularBills, ...bonusBills];

  // Ensure exactly 20 regular bills
  if (regularBills.length !== 20) {
    console.error(`  WARNING: Found ${regularBills.length} regular bills (expected 20) in ${config.slug}`);
    for (const b of allBills) {
      console.error(`    ${b.sort_order}. ${b.bill_number} [${b.liberty_position === 'yea' ? 'Support' : 'Oppose'}]${b.is_bonus ? ' (BONUS)' : ''}`);
    }
  }

  // Only use the 20 regular bill numbers for legislator vote mapping
  const billNumbers = regularBills.map(b => b.bill_number);

  // Extract legislators
  const rawLegislators = extractLegislators(text, config.chamber, billNumbers);

  // Convert alignment values to actual votes
  const legislators = rawLegislators.map(leg => {
    const convertedVotes: Record<string, string> = {};
    for (const [billNum, alignment] of Object.entries(leg.votes)) {
      const bill = bills.find(b => b.bill_number === billNum);
      if (bill) {
        convertedVotes[billNum] = convertAlignmentToVote(alignment, bill.liberty_position);
      } else {
        convertedVotes[billNum] = alignment;
      }
    }
    return { ...leg, votes: convertedVotes };
  });

  const seed = {
    session: {
      name: config.name,
      slug: config.slug,
      jurisdiction: 'federal' as const,
      session_year: config.session_year,
      chamber: config.chamber,
      description: config.description,
      absence_penalty_threshold: 3,
    },
    bills: bills.map(b => ({
      ...b,
      // Clean up description: remove vote result parenthetical from end
      description: b.description
        .replace(/\s*\([^)]*(?:Passed|Failed|Signed)[^)]*\)\s*$/, '')
        .trim(),
    })),
    legislators,
  };

  const outputPath = path.resolve(`seeds/scorecards/${config.slug}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(seed, null, 2) + '\n');

  const totalVotes = legislators.reduce((sum, l) => sum + Object.keys(l.votes).length, 0);
  console.log(`  ${config.slug}: ${bills.length} bills, ${legislators.length} legislators, ${totalVotes} votes`);
}

function main() {
  console.log('Generating seed files for all 9 Liberty Index scorecards...\n');

  for (const config of SCORECARDS) {
    processScorecard(config);
  }

  console.log('\nDone! Seed files written to seeds/scorecards/');
}

main();
