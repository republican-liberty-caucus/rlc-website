import { z } from 'zod';

export const sessionCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  jurisdiction: z.enum(['federal', 'state']).default('federal'),
  stateCode: z.string().max(2).optional(),
  chapterId: z.string().optional(),
  sessionYear: z.number().int().min(2000).max(2100),
});

export const sessionUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  status: z.enum(['draft', 'active', 'published', 'archived']).optional(),
  jurisdiction: z.enum(['federal', 'state']).optional(),
  stateCode: z.string().max(2).optional(),
  chapterId: z.string().optional(),
  sessionYear: z.number().int().min(2000).max(2100).optional(),
});

export const billCreateSchema = z.object({
  legiscanBillId: z.number().int().optional(),
  billNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  libertyPosition: z.enum(['yea', 'nay']),
  category: z.string().max(100).default('other'),
  weight: z.number().min(0.1).max(10).default(1),
  voteDate: z.string().optional(),
  legiscanRollCallId: z.number().int().optional(),
});

export const billUpdateSchema = z.object({
  billNumber: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  libertyPosition: z.enum(['yea', 'nay']).optional(),
  aiSuggestedPosition: z.enum(['yea', 'nay']).optional(),
  aiAnalysis: z.string().optional(),
  category: z.string().max(100).optional(),
  weight: z.number().min(0.1).max(10).optional(),
  voteDate: z.string().optional(),
  billStatus: z.enum(['tracking', 'voted', 'no_vote']).optional(),
  legiscanRollCallId: z.number().int().optional(),
});

export const legislatorCreateSchema = z.object({
  legiscanPeopleId: z.number().int().optional(),
  name: z.string().min(1).max(200),
  party: z.string().min(1).max(50),
  chamber: z.enum(['us_house', 'us_senate', 'state_house', 'state_senate']),
  stateCode: z.string().min(2).max(2),
  district: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const voteImportSchema = z.object({
  votes: z.array(z.object({
    legislatorId: z.string(),
    vote: z.enum(['yea', 'nay', 'not_voting', 'absent']),
    alignedWithLiberty: z.boolean(),
  })).min(1),
});
