/**
 * Confidence Scorer — 5-Factor Weighted Confidence for Political Candidates
 *
 * Adapted from AIdvisor Boost confidence-scorer.ts.
 * Replaces firmMatch with officeMatch; adds political content signals.
 *
 * Factors:
 *   nameMatch      (0–0.4)  — candidate name appears in URL/title
 *   officeMatch    (0–0.3)  — office/district/state reference
 *   locationMatch  (0–0.15) — state or city
 *   domainAuthority(0–0.1)  — known political platforms score higher
 *   contentSignals (0–0.05) — political keywords
 */

import type { ConfidenceFactors, ConfidenceLevel } from './types';

const HIGH_THRESHOLD = 0.7;
const MEDIUM_THRESHOLD = 0.5;
const LOW_THRESHOLD = 0.3;

const POLITICAL_DOMAIN_AUTHORITY: Record<string, number> = {
  'ballotpedia.org': 0.1,
  'votesmart.org': 0.1,
  'opensecrets.org': 0.1,
  'fec.gov': 0.1,
  'govtrack.us': 0.1,
  'congress.gov': 0.1,
  'linkedin.com': 0.1,
  'facebook.com': 0.1,
  'twitter.com': 0.1,
  'x.com': 0.1,
  'instagram.com': 0.09,
  'youtube.com': 0.09,
  'tiktok.com': 0.08,
  'patch.com': 0.07,
  'medium.com': 0.07,
  'substack.com': 0.07,
};

export function calculateConfidence(
  url: string,
  title: string,
  candidateName: string,
  office: string | null,
  state: string | null,
): { factors: ConfidenceFactors; score: number; level: ConfidenceLevel } {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const combined = `${urlLower} ${titleLower}`;

  const factors: ConfidenceFactors = {
    nameMatch: calcNameMatch(combined, candidateName),
    officeMatch: calcOfficeMatch(combined, office, state),
    locationMatch: calcLocationMatch(combined, state),
    domainAuthority: calcDomainAuthority(url),
    contentSignals: calcContentSignals(combined),
  };

  const score = Math.max(0, Math.min(1,
    factors.nameMatch + factors.officeMatch + factors.locationMatch +
    factors.domainAuthority + factors.contentSignals,
  ));

  const level = getLevel(score);
  return { factors, score, level };
}

function calcNameMatch(text: string, name: string): number {
  const parts = name.toLowerCase().split(/\s+/).filter(Boolean);
  const joined = parts.join('');
  const dashed = parts.join('-');

  if (text.includes(joined) || text.includes(dashed)) return 0.4;

  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (text.includes(first) && text.includes(last)) return 0.35;
    if (text.includes(last)) return 0.2;
    if (text.includes(first)) return 0.1;
  }

  return 0;
}

function calcOfficeMatch(text: string, office: string | null, state: string | null): number {
  let score = 0;

  if (office) {
    const officeLower = office.toLowerCase();
    if (text.includes(officeLower)) {
      score += 0.2;
    } else {
      // Check partial (e.g. "senate" in "State Senate District 5")
      const keywords = officeLower.split(/\s+/).filter((w) => w.length > 3);
      if (keywords.some((kw) => text.includes(kw))) {
        score += 0.1;
      }
    }
  }

  // State code in URL (e.g. "/TX/" or "-tx-")
  if (state && state.length === 2) {
    const stateRegex = new RegExp(`[^a-z]${state.toLowerCase()}[^a-z]`);
    if (stateRegex.test(` ${text} `)) {
      score += 0.1;
    }
  }

  return Math.min(0.3, score);
}

function calcLocationMatch(text: string, state: string | null): number {
  if (!state) return 0;
  const stateLower = state.toLowerCase();
  if (text.includes(stateLower)) return 0.15;

  // 2-letter code match (loose)
  if (state.length === 2 && text.includes(state.toLowerCase())) return 0.08;

  return 0;
}

function calcDomainAuthority(url: string): number {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    for (const [domain, score] of Object.entries(POLITICAL_DOMAIN_AUTHORITY)) {
      if (hostname.includes(domain)) return score;
    }
    if (hostname.endsWith('.gov')) return 0.09;
    if (hostname.endsWith('.org')) return 0.06;
    if (hostname.endsWith('.com')) return 0.05;
    return 0.03;
  } catch {
    return 0.03;
  }
}

function calcContentSignals(text: string): number {
  const politicalKeywords = [
    'campaign', 'candidate', 'election', 'vote', 'elect',
    'republican', 'democrat', 'libertarian', 'conservative', 'progressive',
    'district', 'precinct', 'ballot', 'endorsement',
  ];

  const matches = politicalKeywords.filter((kw) => text.includes(kw)).length;
  return Math.min(0.05, matches * 0.015);
}

function getLevel(score: number): ConfidenceLevel {
  if (score >= HIGH_THRESHOLD) return 'HIGH';
  if (score >= MEDIUM_THRESHOLD) return 'MEDIUM';
  if (score >= LOW_THRESHOLD) return 'LOW';
  return 'NONE';
}
