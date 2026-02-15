/**
 * Digital Presence Audit — Shared Types
 *
 * Adapted from AIdvisor Boost Authority Alignment System for political candidate vetting.
 */

// ─── Input ────────────────────────────────────────────────────────

export interface AuditInput {
  candidateFirstName: string;
  candidateLastName: string;
  state: string | null;
  office: string | null;
  district: string | null;
  party: string | null;
  /** URLs already known (e.g. from survey answers) */
  knownUrls: string[];
  /** Opponents to also audit at a reduced depth */
  opponents: OpponentInput[];
}

export interface OpponentInput {
  name: string;
  party: string | null;
}

// ─── Platform Classification ──────────────────────────────────────

export type PlatformCategory =
  | 'social_media'
  | 'professional_network'
  | 'content_platform'
  | 'political_platform'
  | 'news_media'
  | 'campaign_website'
  | 'website'
  | 'other';

export interface PlatformClassification {
  platformType: string;
  platformName: string;
  category: PlatformCategory;
}

// ─── Discovery ────────────────────────────────────────────────────

export interface DiscoveredUrl {
  url: string;
  title: string;
  snippet: string;
  discoveryMethod: string;
  hop: number;
}

export interface DiscoveryResult {
  urls: DiscoveredUrl[];
  hops: HopLog[];
  totalSearches: number;
}

export interface HopLog {
  hop: number;
  query: string;
  resultsFound: number;
  durationMs: number;
}

// ─── Confidence ───────────────────────────────────────────────────

export interface ConfidenceFactors {
  nameMatch: number;       // 0–0.4
  officeMatch: number;     // 0–0.3
  locationMatch: number;   // 0–0.15
  domainAuthority: number; // 0–0.1
  contentSignals: number;  // 0–0.05
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// ─── Per-Platform Scoring (0-12) ──────────────────────────────────

export interface PlatformScores {
  presence: number;       // 0-3
  consistency: number;    // 0-3
  quality: number;        // 0-3
  accessibility: number;  // 0-3
  total: number;          // 0-12
  grade: string;
}

// ─── Overall Scoring (0-100) ──────────────────────────────────────

export interface ScoreBreakdown {
  digitalPresence: number;         // 0-20
  campaignConsistency: number;     // 0-20
  communicationQuality: number;    // 0-20
  voterAccessibility: number;      // 0-20
  competitivePositioning: number;  // 0-20
  total: number;                   // 0-100
  grade: string;
}

// ─── Risk ─────────────────────────────────────────────────────────

export type RiskCategory = 'security' | 'consistency' | 'abandonment' | 'reputation' | 'compliance';
export type RiskSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface RiskResult {
  category: RiskCategory;
  severity: RiskSeverity;
  score: number; // 0-100
  description: string;
  mitigation: string;
  platformUrl?: string;
}

export interface RiskAssessment {
  overallScore: number;
  overallSeverity: RiskSeverity;
  risks: RiskResult[];
  criticalCount: number;
  highCount: number;
}

// ─── Platform Result (maps to DB row) ─────────────────────────────

export interface PlatformResult {
  entityType: 'candidate' | 'opponent';
  entityName: string;
  platformName: string;
  platformUrl: string | null;
  confidenceScore: number | null;
  discoveryMethod: string | null;
  activityStatus: string | null;
  lastActivityDate: string | null;
  followers: number | null;
  engagementRate: number | null;
  scorePresence: number | null;
  scoreConsistency: number | null;
  scoreQuality: number | null;
  scoreAccessibility: number | null;
  totalScore: number | null;
  grade: string | null;
  contactMethods: Record<string, unknown> | null;
}

// ─── Opponent Mini-Audit ──────────────────────────────────────────

export interface OpponentAuditResult {
  name: string;
  party: string | null;
  platformCount: number;
  overallScore: number | null;
  grade: string | null;
  platforms: PlatformResult[];
  auditFailed?: boolean;
  failureReason?: string;
}

// ─── Full Audit Result ────────────────────────────────────────────

export interface AuditResult {
  candidatePlatforms: PlatformResult[];
  scoreBreakdown: ScoreBreakdown;
  riskAssessment: RiskAssessment;
  opponentAudits: OpponentAuditResult[];
  discoveryLog: DiscoveryResult;
}
