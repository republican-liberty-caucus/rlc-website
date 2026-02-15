import { z } from 'zod';

export const surveyCreateSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  officeTypeId: z.string().uuid().optional(),
  electionType: z.enum(['primary', 'general', 'special', 'runoff', 'primary_runoff']).optional(),
  state: z.string().length(2).toUpperCase().optional(),
  primaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  generalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  electionDeadlineId: z.string().uuid().optional(),
  charterId: z.string().uuid().optional(),
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
  officeTypeId: z.string().uuid().nullable().optional(),
  electionType: z.enum(['primary', 'general', 'special', 'runoff', 'primary_runoff']).nullable().optional(),
  state: z.string().length(2).toUpperCase().nullable().optional(),
  primaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  generalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  electionDeadlineId: z.string().uuid().nullable().optional(),
  charterId: z.string().uuid().nullable().optional(),
});

export const candidateCreateSchema = z.object({
  candidateFirstName: z.string().min(1).max(100),
  candidateLastName: z.string().max(100).default(''),
  candidateEmail: z.string().email().optional(),
  candidateParty: z.string().optional(),
  candidateOffice: z.string().optional(),
  candidateDistrict: z.string().optional(),
  officeTypeId: z.string().uuid().optional(),
  candidateState: z.string().length(2).optional(),
  candidateCounty: z.string().max(100).optional(),
});

export const surveySubmissionSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string().min(1),
  })).min(1),
});
