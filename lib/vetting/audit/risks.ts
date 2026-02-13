/**
 * Risk Analyzer — Political Candidate Risk Assessment
 *
 * Adapted from AIdvisor Boost risk-analyzer.ts.
 *
 * Categories (weighted):
 *   Security    (30%) — unsecured sites, exposed personal info
 *   Consistency (25%) — conflicting messaging across platforms
 *   Abandonment (20%) — inactive accounts, stale content
 *   Reputation  (15%) — negative press, controversial posts
 *   Compliance  (10%) — FEC disclaimer missing, campaign finance disclosure
 *
 * Severity: CRITICAL (≥80), HIGH (≥60), MEDIUM (≥40), LOW (≥20), NONE (<20)
 */

import type { RiskResult, RiskAssessment, RiskSeverity, PlatformResult } from './types';

const SEVERITY_THRESHOLDS: [number, RiskSeverity][] = [
  [80, 'CRITICAL'], [60, 'HIGH'], [40, 'MEDIUM'], [20, 'LOW'], [0, 'NONE'],
];

const RISK_WEIGHTS: Record<string, number> = {
  security: 0.30,
  consistency: 0.25,
  abandonment: 0.20,
  reputation: 0.15,
  compliance: 0.10,
};

function getSeverity(score: number): RiskSeverity {
  for (const [threshold, level] of SEVERITY_THRESHOLDS) {
    if (score >= threshold) return level;
  }
  return 'NONE';
}

export function assessRisks(platforms: PlatformResult[]): RiskAssessment {
  const candidatePlatforms = platforms.filter((p) => p.entityType === 'candidate');
  const risks: RiskResult[] = [];

  // ─── Security ───────────────────────────────────────────
  let securityScore = 0;

  for (const p of candidatePlatforms) {
    if (p.platformUrl && p.platformUrl.startsWith('http://')) {
      risks.push({
        category: 'security',
        severity: 'HIGH',
        score: 25,
        description: `${p.platformName} does not use HTTPS`,
        mitigation: 'Enable SSL/HTTPS to protect visitor data',
        platformUrl: p.platformUrl,
      });
      securityScore += 25;
    }
  }

  // No campaign website found
  const hasWebsite = candidatePlatforms.some((p) =>
    p.platformName.toLowerCase().includes('website') ||
    (p.platformUrl && !p.platformUrl.includes('facebook') && !p.platformUrl.includes('twitter')),
  );
  if (!hasWebsite && candidatePlatforms.length > 0) {
    risks.push({
      category: 'security',
      severity: 'MEDIUM',
      score: 15,
      description: 'No dedicated campaign website detected',
      mitigation: 'Create a campaign website to control messaging and collect supporter info',
    });
    securityScore += 15;
  }

  securityScore = Math.min(100, securityScore);

  // ─── Consistency ────────────────────────────────────────
  let consistencyScore = 0;

  const consistencyScores = candidatePlatforms
    .map((p) => p.scoreConsistency ?? 0)
    .filter((s) => s > 0);

  if (consistencyScores.length > 0) {
    const avgConsistency = consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;
    if (avgConsistency < 1) {
      risks.push({
        category: 'consistency',
        severity: 'HIGH',
        score: 30,
        description: 'Severe messaging inconsistency across platforms',
        mitigation: 'Standardize campaign branding, logo, and messaging across all platforms',
      });
      consistencyScore += 30;
    } else if (avgConsistency < 2) {
      risks.push({
        category: 'consistency',
        severity: 'MEDIUM',
        score: 15,
        description: 'Moderate messaging inconsistency detected',
        mitigation: 'Review and align platform bios, images, and campaign messaging',
      });
      consistencyScore += 15;
    }
  }

  consistencyScore = Math.min(100, consistencyScore);

  // ─── Abandonment ────────────────────────────────────────
  let abandonmentScore = 0;

  const inactiveCount = candidatePlatforms.filter(
    (p) => p.activityStatus === 'inactive' || p.activityStatus === 'abandoned',
  ).length;

  if (inactiveCount > 0) {
    const severity: RiskSeverity = inactiveCount >= 3 ? 'HIGH' : 'MEDIUM';
    const score = inactiveCount >= 3 ? 40 : 20;
    risks.push({
      category: 'abandonment',
      severity,
      score,
      description: `${inactiveCount} inactive or abandoned platform(s) found`,
      mitigation: 'Reactivate important accounts or deactivate to prevent voter confusion',
    });
    abandonmentScore += score;
  }

  abandonmentScore = Math.min(100, abandonmentScore);

  // ─── Reputation ─────────────────────────────────────────
  // Reputation risks are harder to detect without content analysis.
  // For now, flag low-quality platforms as a proxy.
  let reputationScore = 0;

  const lowQualityCount = candidatePlatforms.filter(
    (p) => p.scoreQuality != null && p.scoreQuality <= 1,
  ).length;

  if (lowQualityCount >= 2) {
    risks.push({
      category: 'reputation',
      severity: 'MEDIUM',
      score: 20,
      description: `${lowQualityCount} platform(s) have low content quality scores`,
      mitigation: 'Improve content quality and professionalism on all public-facing platforms',
    });
    reputationScore += 20;
  }

  reputationScore = Math.min(100, reputationScore);

  // ─── Compliance ─────────────────────────────────────────
  let complianceScore = 0;

  // Check for platforms missing contact methods (proxy for missing FEC disclaimers)
  const noContactCount = candidatePlatforms.filter(
    (p) => p.contactMethods == null || Object.keys(p.contactMethods).length === 0,
  ).length;

  if (noContactCount > candidatePlatforms.length / 2 && candidatePlatforms.length > 0) {
    risks.push({
      category: 'compliance',
      severity: 'MEDIUM',
      score: 20,
      description: 'Most platforms lack visible contact or disclosure information',
      mitigation: 'Add FEC-required paid-for-by disclaimers and contact info on all campaign materials',
    });
    complianceScore += 20;
  }

  complianceScore = Math.min(100, complianceScore);

  // ─── Overall ────────────────────────────────────────────
  const overallScore = Math.round(
    securityScore * RISK_WEIGHTS.security +
    consistencyScore * RISK_WEIGHTS.consistency +
    abandonmentScore * RISK_WEIGHTS.abandonment +
    reputationScore * RISK_WEIGHTS.reputation +
    complianceScore * RISK_WEIGHTS.compliance,
  );

  const criticalCount = risks.filter((r) => r.severity === 'CRITICAL').length;
  const highCount = risks.filter((r) => r.severity === 'HIGH').length;

  return {
    overallScore,
    overallSeverity: getSeverity(overallScore),
    risks,
    criticalCount,
    highCount,
  };
}
