import { z } from 'zod';

export const surveyCreateSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  electionType: z.string().optional(),
  electionDate: z.string().optional(),
  state: z.string().optional(),
  charterId: z.string().optional(),
  questions: z.array(z.object({
    questionText: z.string().min(1),
    questionType: z.enum(['scale', 'yes_no', 'text', 'multiple_choice']),
    options: z.array(z.string()).default([]),
    weight: z.number().min(0.1).max(10).default(1),
    sortOrder: z.number().int().default(0),
    idealAnswer: z.string().optional(),
  })).min(1),
});

export const surveyUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
  electionType: z.string().optional(),
  electionDate: z.string().optional(),
  state: z.string().optional(),
  charterId: z.string().optional(),
});

export const candidateCreateSchema = z.object({
  candidateName: z.string().min(1).max(200),
  candidateEmail: z.string().email().optional(),
  candidateParty: z.string().optional(),
  candidateOffice: z.string().optional(),
  candidateDistrict: z.string().optional(),
});

export const surveySubmissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string().min(1),
  })).min(1),
});
