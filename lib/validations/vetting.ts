import { z } from 'zod';

// ============================================
// Enum constants for Zod validation
// ============================================

export const VETTING_STAGES = [
  'survey_submitted', 'auto_audit', 'assigned', 'research',
  'interview', 'committee_review', 'board_vote',
] as const;

export const VETTING_REPORT_SECTION_TYPES = [
  'digital_presence_audit', 'executive_summary', 'election_schedule',
  'voting_rules', 'candidate_background', 'incumbent_record',
  'opponent_research', 'electoral_results', 'district_data',
] as const;

export const VETTING_SECTION_STATUSES = [
  'section_not_started', 'section_assigned', 'section_in_progress',
  'section_completed', 'needs_revision',
] as const;

export const VETTING_RECOMMENDATIONS = [
  'endorse', 'do_not_endorse', 'no_position',
] as const;

export const BOARD_VOTE_CHOICES = [
  'vote_endorse', 'vote_do_not_endorse', 'vote_no_position', 'vote_abstain',
] as const;

export const COMMITTEE_ROLES = ['chair', 'committee_member'] as const;

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
] as const;

// ============================================
// Committee schemas
// ============================================

export const committeeCreateSchema = z.object({
  name: z.string().min(1).max(200),
});

export const committeeMemberAddSchema = z.object({
  contactId: z.string().uuid(),
  role: z.enum(COMMITTEE_ROLES).default('committee_member'),
});

export const committeeMemberUpdateSchema = z.object({
  role: z.enum(COMMITTEE_ROLES).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Election deadline schemas
// ============================================

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format');

export const electionDeadlineCreateSchema = z.object({
  stateCode: z.string().length(2).toUpperCase(),
  cycleYear: z.number().int().min(2020).max(2040),
  officeType: z.string().min(1).max(100),
  primaryDate: dateStringSchema.nullable().optional(),
  primaryRunoffDate: dateStringSchema.nullable().optional(),
  generalDate: dateStringSchema.nullable().optional(),
  generalRunoffDate: dateStringSchema.nullable().optional(),
  filingDeadline: dateStringSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const electionDeadlineUpdateSchema = electionDeadlineCreateSchema.partial();

// ============================================
// Vetting schemas
// ============================================

export const vettingCreateSchema = z.object({
  candidateResponseId: z.string().uuid(),
  committeeId: z.string().uuid().optional(),
  electionDeadlineId: z.string().uuid().optional(),
});

export const vettingUpdateSchema = z.object({
  committeeId: z.string().uuid().nullable().optional(),
  electionDeadlineId: z.string().uuid().nullable().optional(),
  districtDataId: z.string().uuid().nullable().optional(),
  candidateState: z.string().regex(/^[A-Z]{2}$/, 'Must be a valid 2-letter state code').nullable().optional(),
});

export const vettingStageAdvanceSchema = z.object({
  targetStage: z.enum(VETTING_STAGES),
});

// ============================================
// Report section schemas
// ============================================

export const sectionUpdateSchema = z.object({
  data: z.record(z.unknown()).optional(),
  status: z.enum(VETTING_SECTION_STATUSES).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const sectionAssignSchema = z.object({
  committeeMemberId: z.string().uuid(),
});

export const sectionAcceptDraftSchema = z.object({
  mergeStrategy: z.enum(['replace', 'merge']).default('replace'),
});

export const aiDraftGenerateSchema = z.object({
  force: z.boolean().default(false),
});

// ============================================
// Opponent schemas
// ============================================

export const opponentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  party: z.string().max(100).nullable().optional(),
  isIncumbent: z.boolean().default(false),
  background: z.string().max(5000).nullable().optional(),
  credibility: z.string().max(5000).nullable().optional(),
  fundraising: z.record(z.unknown()).nullable().optional(),
  endorsements: z.array(z.string().max(200)).max(100).default([]),
  socialLinks: z.record(z.unknown()).nullable().optional(),
  photoUrl: z.string().url().refine((u) => u.startsWith('https://'), 'Must be HTTPS').nullable().optional(),
});

export const opponentUpdateSchema = opponentCreateSchema.partial();

// ============================================
// Interview schemas
// ============================================

export const interviewUpdateSchema = z.object({
  interviewDate: z.string().datetime().nullable().optional(),
  interviewNotes: z.string().max(10000).nullable().optional(),
  interviewers: z.array(z.string().max(200)).max(50).optional(),
});

// ============================================
// Recommendation schemas
// ============================================

export const recommendationSchema = z.object({
  recommendation: z.enum(VETTING_RECOMMENDATIONS),
  notes: z.string().max(5000).nullable().optional(),
});

// ============================================
// Board vote schemas
// ============================================

export const boardVoteSchema = z.object({
  vote: z.enum(BOARD_VOTE_CHOICES),
  notes: z.string().max(2000).nullable().optional(),
});

// ============================================
// District data schemas
// ============================================

export const districtDataCreateSchema = z.object({
  stateCode: z.string().length(2).toUpperCase(),
  districtId: z.string().min(1).max(50),
  officeType: z.string().min(1).max(100),
  cookPvi: z.string().max(20).nullable().optional(),
  population: z.number().int().positive().nullable().optional(),
  partyRegistration: z.record(z.unknown()).nullable().optional(),
  municipalities: z.array(z.string()).default([]),
  counties: z.array(z.string()).default([]),
  overlappingDistricts: z.array(z.string()).default([]),
  electoralHistory: z.record(z.unknown()).nullable().optional(),
  mapUrl: z.string().url().nullable().optional(),
});

export const districtDataUpdateSchema = districtDataCreateSchema.partial();

// ============================================
// Audit schemas
// ============================================

export const AUDIT_STATUSES = ['audit_pending', 'running', 'audit_completed', 'audit_failed'] as const;

export const auditTriggerSchema = z.object({
  force: z.boolean().default(false),
});

export type AuditTriggerInput = z.infer<typeof auditTriggerSchema>;

// ============================================
// Pipeline filter schemas
// ============================================

export const pipelineFilterSchema = z.object({
  stage: z.enum(VETTING_STAGES).optional(),
  state: z.string().max(2).optional(),
  urgency: z.enum(['all', 'amber', 'red']).optional(),
});

// ============================================
// Inferred types
// ============================================

export type CommitteeCreateInput = z.infer<typeof committeeCreateSchema>;
export type CommitteeMemberAddInput = z.infer<typeof committeeMemberAddSchema>;
export type CommitteeMemberUpdateInput = z.infer<typeof committeeMemberUpdateSchema>;
export type ElectionDeadlineCreateInput = z.infer<typeof electionDeadlineCreateSchema>;
export type ElectionDeadlineUpdateInput = z.infer<typeof electionDeadlineUpdateSchema>;
export type VettingCreateInput = z.infer<typeof vettingCreateSchema>;
export type VettingUpdateInput = z.infer<typeof vettingUpdateSchema>;
export type SectionUpdateInput = z.infer<typeof sectionUpdateSchema>;
export type SectionAssignInput = z.infer<typeof sectionAssignSchema>;
export type OpponentCreateInput = z.infer<typeof opponentCreateSchema>;
export type OpponentUpdateInput = z.infer<typeof opponentUpdateSchema>;
export type InterviewUpdateInput = z.infer<typeof interviewUpdateSchema>;
export type RecommendationInput = z.infer<typeof recommendationSchema>;
export type BoardVoteInput = z.infer<typeof boardVoteSchema>;
export type DistrictDataCreateInput = z.infer<typeof districtDataCreateSchema>;
export type DistrictDataUpdateInput = z.infer<typeof districtDataUpdateSchema>;
export type PipelineFilterInput = z.infer<typeof pipelineFilterSchema>;
export type AiDraftGenerateInput = z.infer<typeof aiDraftGenerateSchema>;
export type SectionAcceptDraftInput = z.infer<typeof sectionAcceptDraftSchema>;
