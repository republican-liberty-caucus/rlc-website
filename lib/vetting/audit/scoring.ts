/**
 * Scoring Engine — Dual-Level Scoring for Political Candidates
 *
 * Adapted from AIdvisor Boost scoring-engine.ts.
 *
 * Per-Platform (0-12): presence + consistency + quality + accessibility (each 0-3)
 * Overall    (0-100): 5 dimensions × 20 points
 *   - Digital Presence (0-20)
 *   - Campaign Consistency (0-20)
 *   - Communication Quality (0-20)
 *   - Voter Accessibility (0-20)
 *   - Competitive Positioning (0-20)
 */

import type { PlatformScores, ScoreBreakdown, PlatformResult, OpponentAuditResult } from './types';

// ─── Grade Thresholds ─────────────────────────────────────────────

const PLATFORM_GRADES: [number, string][] = [
  [11, 'A'], [9, 'B'], [7, 'C'], [5, 'D'], [0, 'F'],
];

const OVERALL_GRADES: [number, string][] = [
  [97, 'A+'], [93, 'A'], [90, 'A-'],
  [87, 'B+'], [83, 'B'], [80, 'B-'],
  [77, 'C+'], [73, 'C'], [70, 'C-'],
  [67, 'D+'], [63, 'D'], [0, 'F'],
];

export function getGrade(score: number, thresholds: [number, string][]): string {
  for (const [min, grade] of thresholds) {
    if (score >= min) return grade;
  }
  return 'F';
}

// ─── Per-Platform Scoring (0-12) ──────────────────────────────────

export interface PlatformScoringInput {
  hasProfile: boolean;
  isActive: boolean;
  lastActivityRecent: boolean; // within 30 days
  namingConsistent: boolean;
  messagingConsistent: boolean;
  hasLogo: boolean;
  contentQuality: 'good' | 'fair' | 'poor';
  professionalPresentation: boolean;
  hasContactInfo: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
}

export function scorePlatform(input: PlatformScoringInput): PlatformScores {
  // Presence (0-3)
  let presence = 0;
  if (input.hasProfile) presence += 1;
  if (input.isActive) presence += 1;
  else if (input.lastActivityRecent) presence += 0.5;
  if (input.hasLogo) presence += 1;
  presence = Math.min(3, presence);

  // Consistency (0-3)
  let consistency = 0;
  if (input.namingConsistent) consistency += 1;
  if (input.messagingConsistent) consistency += 1;
  if (input.hasLogo) consistency += 1;
  consistency = Math.min(3, consistency);

  // Quality (0-3)
  let quality = 0;
  if (input.contentQuality === 'good') quality += 2;
  else if (input.contentQuality === 'fair') quality += 1;
  if (input.professionalPresentation) quality += 1;
  quality = Math.min(3, quality);

  // Accessibility (0-3)
  let accessibility = 0;
  if (input.hasContactInfo) accessibility += 1;
  const contactCount = [input.hasEmail, input.hasPhone, input.hasWebsite].filter(Boolean).length;
  if (contactCount >= 2) accessibility += 1;
  if (contactCount >= 3) accessibility += 1;
  accessibility = Math.min(3, accessibility);

  const total = Math.round(presence + consistency + quality + accessibility);
  const grade = getGrade(total, PLATFORM_GRADES);

  return { presence, consistency, quality, accessibility, total, grade };
}

// ─── Overall Scoring (0-100) ──────────────────────────────────────

export function scoreOverall(
  candidatePlatforms: PlatformResult[],
  opponentAudits: OpponentAuditResult[],
): ScoreBreakdown {
  const platforms = candidatePlatforms.filter((p) => p.entityType === 'candidate');
  const count = platforms.length;

  if (count === 0) {
    return {
      digitalPresence: 0,
      campaignConsistency: 0,
      communicationQuality: 0,
      voterAccessibility: 0,
      competitivePositioning: 0,
      total: 0,
      grade: 'F',
    };
  }

  // 1. Digital Presence (0-20): platform count, activity, coverage
  let digitalPresence = 0;
  const platformRatio = Math.min(1, count / 10); // 10 platforms → max
  digitalPresence += platformRatio * 10;
  const activeCount = platforms.filter((p) => p.activityStatus === 'active').length;
  digitalPresence += (activeCount / count) * 6;
  const scoredCount = platforms.filter((p) => p.totalScore != null && p.totalScore > 0).length;
  digitalPresence += (scoredCount / count) * 4;
  digitalPresence = Math.min(20, digitalPresence);

  // 2. Campaign Consistency (0-20): name/messaging alignment
  let campaignConsistency = 0;
  const consistencyScores = platforms.map((p) => p.scoreConsistency ?? 0);
  const avgConsistency = consistencyScores.reduce((a, b) => a + b, 0) / count;
  campaignConsistency = Math.min(20, (avgConsistency / 3) * 20);

  // 3. Communication Quality (0-20)
  let communicationQuality = 0;
  const qualityScores = platforms.map((p) => p.scoreQuality ?? 0);
  const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / count;
  communicationQuality = Math.min(20, (avgQuality / 3) * 20);

  // 4. Voter Accessibility (0-20): contact methods, response channels
  let voterAccessibility = 0;
  const accessScores = platforms.map((p) => p.scoreAccessibility ?? 0);
  const avgAccess = accessScores.reduce((a, b) => a + b, 0) / count;
  voterAccessibility = Math.min(20, (avgAccess / 3) * 20);

  // 5. Competitive Positioning (0-20): candidate vs opponents
  let competitivePositioning = 10; // baseline
  if (opponentAudits.length > 0) {
    const avgOpponentPlatforms = opponentAudits.reduce((s, o) => s + o.platformCount, 0) / opponentAudits.length;
    if (count > avgOpponentPlatforms) competitivePositioning += 5;
    else if (count === avgOpponentPlatforms) competitivePositioning += 2;

    const avgOpponentScore = opponentAudits.reduce((s, o) => s + (o.overallScore ?? 0), 0) / opponentAudits.length;
    const candidateAvgTotal = platforms.reduce((s, p) => s + (p.totalScore ?? 0), 0) / count;
    if (candidateAvgTotal > avgOpponentScore) competitivePositioning += 5;
    else if (candidateAvgTotal >= avgOpponentScore * 0.9) competitivePositioning += 2;
  }
  competitivePositioning = Math.min(20, competitivePositioning);

  const total = Math.round(
    digitalPresence + campaignConsistency + communicationQuality +
    voterAccessibility + competitivePositioning,
  );

  return {
    digitalPresence: Math.round(digitalPresence * 10) / 10,
    campaignConsistency: Math.round(campaignConsistency * 10) / 10,
    communicationQuality: Math.round(communicationQuality * 10) / 10,
    voterAccessibility: Math.round(voterAccessibility * 10) / 10,
    competitivePositioning: Math.round(competitivePositioning * 10) / 10,
    total,
    grade: getGrade(total, OVERALL_GRADES),
  };
}
